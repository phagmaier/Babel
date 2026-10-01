//! Application-scoped spelling, separate from the source/recovery mutex and queue.
use crate::enchant::Broker;
use screenwriter_core::documents::{DocumentService, spellcheck::*};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicUsize, Ordering},
};
#[derive(Default)]
pub struct SpellcheckHost {
    pub service: Arc<Mutex<Option<DocumentService>>>,
    ignored: Arc<Mutex<HashSet<(String, String)>>>,
    pending: Arc<AtomicUsize>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SpellcheckRequest {
    action: Action,
    #[serde(default)]
    language: String,
    #[serde(default)]
    enabled: Option<bool>,
    #[serde(default, deserialize_with = "bounded_words")]
    words: Vec<String>,
}
fn bounded_words<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Vec<String>, D::Error> {
    struct Words;
    impl<'de> serde::de::Visitor<'de> for Words {
        type Value = Vec<String>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("at most 128 validated words")
        }
        fn visit_seq<A: serde::de::SeqAccess<'de>>(
            self,
            mut seq: A,
        ) -> Result<Self::Value, A::Error> {
            let mut words = Vec::new();
            while let Some(word) = seq.next_element::<String>()? {
                if words.len() >= 128 || !valid_word(&word) {
                    return Err(serde::de::Error::custom("invalidSpellcheckRequest"));
                }
                words.push(word);
            }
            Ok(words)
        }
    }
    deserializer.deserialize_seq(Words)
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
enum Action {
    Status,
    Configure,
    Check,
    Suggest,
    Ignore,
    Add,
}
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SpellcheckReply {
    enabled: bool,
    language: String,
    languages: Vec<String>,
    available: bool,
    needs_attention: bool,
    added_count: usize,
    ignored_count: usize,
    resource: String,
    correct: Vec<bool>,
    suggestions: Vec<String>,
}
struct Permit(Arc<AtomicUsize>);
impl Drop for Permit {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}
impl SpellcheckRequest {
    fn valid(&self) -> bool {
        self.words.len() <= 128
            && self.words.iter().all(|w| valid_word(w))
            && match self.action {
                Action::Status => {
                    self.language.is_empty() && self.words.is_empty() && self.enabled.is_none()
                }
                Action::Configure => {
                    valid_language(&self.language)
                        && self.words.is_empty()
                        && self.enabled.is_some()
                }
                Action::Check => {
                    valid_language(&self.language)
                        && self.enabled.is_none()
                        && !self.words.is_empty()
                }
                Action::Suggest | Action::Ignore | Action::Add => {
                    valid_language(&self.language)
                        && self.enabled.is_none()
                        && self.words.len() == 1
                }
            }
    }
}
impl SpellcheckHost {
    fn perform(&self, request: SpellcheckRequest) -> Result<SpellcheckReply, &'static str> {
        if !request.valid() {
            return Err("invalidSpellcheckRequest");
        }
        let guard = self.service.lock().map_err(|_| "spellcheckUnavailable")?;
        let service = guard.as_ref().ok_or("spellcheckUnavailable")?;
        let stored = service
            .read_spellcheck_settings()
            .map_err(|_| "dictionaryStorageUnavailable")?;
        let mut settings = stored.settings;
        let broker = Broker::new()?;
        let languages = broker.languages();
        let mut ignored = self.ignored.lock().map_err(|_| "spellcheckUnavailable")?;
        let mut correct = Vec::new();
        let mut suggestions = Vec::new();
        match request.action {
            Action::Status => (),
            Action::Configure => {
                settings.language = request.language;
                settings.enabled = request.enabled.unwrap();
                service
                    .publish_spellcheck_settings(stored.generation, settings.clone())
                    .map_err(|_| "dictionaryWriteFailed")?;
            }
            _ => {
                if !settings.enabled {
                    return Err("spellcheckOff");
                }
                if request.language != settings.language {
                    return Err("staleSpellcheckLanguage");
                }
                let dict = broker.dictionary(&request.language)?;
                match request.action {
                    Action::Check | Action::Suggest => {
                        for word in &request.words {
                            let key = (settings.language.clone(), word.to_lowercase());
                            correct.push(
                                ignored.contains(&key)
                                    || settings.added.iter().any(|e| {
                                        e.language == key.0 && e.word.to_lowercase() == key.1
                                    })
                                    || dict.check(word)?,
                            );
                        }
                        if matches!(request.action, Action::Suggest) && correct == [false] {
                            suggestions = dict.suggest(&request.words[0])?;
                        }
                    }
                    Action::Ignore => {
                        if ignored.len() >= MAX_ADDED_WORDS {
                            return Err("dictionaryLimit");
                        }
                        ignored
                            .insert((settings.language.clone(), request.words[0].to_lowercase()));
                    }
                    Action::Add => {
                        let word = &request.words[0];
                        if !settings.added.iter().any(|e| {
                            e.language == settings.language
                                && e.word.to_lowercase() == word.to_lowercase()
                        }) {
                            if settings.added.len() >= MAX_ADDED_WORDS {
                                return Err("dictionaryLimit");
                            }
                            settings.added.push(AddedWord {
                                language: settings.language.clone(),
                                word: word.clone(),
                            });
                        }
                        service
                            .publish_spellcheck_settings(stored.generation, settings.clone())
                            .map_err(|_| "dictionaryWriteFailed")?;
                    }
                    _ => unreachable!(),
                }
            }
        }
        Ok(SpellcheckReply {
            enabled: settings.enabled,
            available: languages.contains(&settings.language),
            language: settings.language,
            languages,
            needs_attention: stored.needs_attention,
            added_count: settings.added.len(),
            ignored_count: ignored.len(),
            resource: format!(
                "Enchant {} / Hunspell · installed offline dictionaries",
                broker.version()
            ),
            correct,
            suggestions,
        })
    }
}
#[tauri::command]
pub async fn spellcheck(
    request: SpellcheckRequest,
    state: tauri::State<'_, SpellcheckHost>,
) -> Result<SpellcheckReply, &'static str> {
    if !request.valid() {
        return Err("invalidSpellcheckRequest");
    }
    if state
        .pending
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| {
            (n < 2).then_some(n + 1)
        })
        .is_err()
    {
        return Err("spellcheckBusy");
    }
    let permit = Permit(state.pending.clone());
    let worker = SpellcheckHost {
        service: state.service.clone(),
        ignored: state.ignored.clone(),
        pending: state.pending.clone(),
    };
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        worker.perform(request)
    })
    .await
    .map_err(|_| "spellcheckUnavailable")?
}
#[cfg(test)]
#[path = "spellcheck_host_tests.rs"]
mod tests;
