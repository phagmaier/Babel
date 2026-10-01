//! Bounded application-only vocabulary/preferences, never manuscript content.
use serde::{Deserialize, Serialize};

pub const MAX_ADDED_WORDS: usize = 2048;
pub const MAX_SPELLCHECK_BYTES: usize = 1024 * 1024;
pub fn valid_language(language: &str) -> bool {
    (2..=32).contains(&language.len())
        && language.as_bytes()[0].is_ascii_alphabetic()
        && language
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
}
pub fn valid_word(word: &str) -> bool {
    !word.is_empty()
        && word.len() <= 128
        && word.chars().any(char::is_alphabetic)
        && word.chars().all(|c| {
            c.is_alphabetic()
                || c.is_numeric()
                || matches!(c, '\u{0300}'..='\u{036f}' | '\'' | '’' | '-')
        })
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AddedWord {
    pub language: String,
    pub word: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SpellcheckSettings {
    pub enabled: bool,
    pub language: String,
    pub added: Vec<AddedWord>,
}
impl Default for SpellcheckSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            language: "en_US".into(),
            added: Vec::new(),
        }
    }
}
impl SpellcheckSettings {
    pub fn valid(&self) -> bool {
        let mut seen = std::collections::HashSet::new();
        valid_language(&self.language)
            && self.added.len() <= MAX_ADDED_WORDS
            && self.added.iter().all(|e| {
                valid_language(&e.language)
                    && valid_word(&e.word)
                    && seen.insert((&e.language, e.word.to_lowercase()))
            })
    }
}
#[derive(Clone, Debug)]
pub struct SpellcheckStored {
    pub generation: u64,
    pub settings: SpellcheckSettings,
    pub needs_attention: bool,
}
