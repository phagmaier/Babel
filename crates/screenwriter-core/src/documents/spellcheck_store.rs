//! Reuses private descriptor/lease primitives. Two checksummed slots retain a
//! previous valid dictionary even across interrupted publication; no auto repair.
use super::*;
use crate::documents::spellcheck::*;
const SLOTS: [&str; 2] = ["spellcheck-0.json", "spellcheck-1.json"];
const PENDING: &str = "spellcheck.pending";
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Generation {
    schema_version: u32,
    generation: u64,
    settings: SpellcheckSettings,
    sha256: String,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Stage {
    PartialWrite,
    FileSynced,
    Replaced,
    DirectorySynced,
}
fn attention() -> DocumentError {
    error(ErrorCode::Io)
}
impl DocumentService {
    pub fn read_spellcheck_settings(&self) -> Result<SpellcheckStored, DocumentError> {
        let lease = self.lease("spellcheck")?;
        let stored = self.read_spellcheck_slots()?;
        self.verify_lease(&lease)?;
        Ok(stored)
    }
    fn read_spellcheck_slots(&self) -> Result<SpellcheckStored, DocumentError> {
        self.verify_store()?;
        let mut good: Vec<Generation> = Vec::new();
        let mut bad = false;
        for (slot, name) in SLOTS.iter().enumerate() {
            match read_file(&self.store, OsStr::new(name)) {
                Ok(file) => {
                    let result = (|| {
                        if !private_file(&stat(&file)?) {
                            return Err(attention());
                        }
                        let (bytes, _) = snapshot(file, MAX_SPELLCHECK_BYTES)?;
                        let g: Generation =
                            serde_json::from_slice(&bytes).map_err(|_| attention())?;
                        if g.schema_version != 1
                            || g.generation == 0
                            || g.generation % 2 != slot as u64
                            || !g.settings.valid()
                            || hash(&serde_json::to_vec(&g.settings).map_err(|_| attention())?)
                                != g.sha256
                        {
                            return Err(attention());
                        }
                        Ok(g)
                    })();
                    match result {
                        Ok(g) => good.push(g),
                        Err(_) => bad = true,
                    }
                }
                Err(e) if e.code == ErrorCode::MissingSource => (),
                Err(_) => bad = true,
            }
        }
        match read_file(&self.store, OsStr::new(PENDING)) {
            Err(e) if e.code == ErrorCode::MissingSource => (),
            _ => bad = true,
        }
        good.sort_by_key(|g| g.generation);
        if good.len() == 2 && good[1].generation != good[0].generation + 1 {
            bad = true;
        }
        if let Some(g) = good.pop() {
            Ok(SpellcheckStored {
                generation: g.generation,
                settings: g.settings,
                needs_attention: bad,
            })
        } else if bad {
            // Corrupt existing state never silently resets to a blank dictionary.
            Err(attention())
        } else {
            Ok(SpellcheckStored {
                generation: 0,
                settings: SpellcheckSettings::default(),
                needs_attention: false,
            })
        }
    }
    pub fn publish_spellcheck_settings(
        &self,
        expected: u64,
        settings: SpellcheckSettings,
    ) -> Result<u64, DocumentError> {
        self.publish_spellcheck_with(expected, settings, &mut |_| Ok(()))
    }
    fn publish_spellcheck_with(
        &self,
        expected: u64,
        settings: SpellcheckSettings,
        gate: &mut impl FnMut(Stage) -> Result<(), DocumentError>,
    ) -> Result<u64, DocumentError> {
        if !settings.valid() {
            return Err(attention());
        }
        let lease = self.lease("spellcheck")?;
        let old = self.read_spellcheck_slots()?;
        if old.needs_attention || old.generation != expected {
            return Err(attention());
        }
        if old.settings == settings {
            return Ok(old.generation);
        }
        let generation = old.generation.checked_add(1).ok_or_else(attention)?;
        let sha256 = hash(&serde_json::to_vec(&settings).map_err(|_| attention())?);
        let bytes = serde_json::to_vec(&Generation {
            schema_version: 1,
            generation,
            settings,
            sha256,
        })
        .map_err(|_| attention())?;
        if bytes.len() > MAX_SPELLCHECK_BYTES {
            return Err(attention());
        }
        self.verify_lease(&lease)?;
        let mut file =
            create_private(&self.store, PENDING, OFlags::WRONLY).map_err(syscall_error)?;
        let half = bytes.len() / 2;
        file.write_all(&bytes[..half]).map_err(io_error)?;
        gate(Stage::PartialWrite)?;
        file.write_all(&bytes[half..]).map_err(io_error)?;
        file.sync_all().map_err(io_error)?;
        gate(Stage::FileSynced)?;
        if snapshot(
            read_file(&self.store, OsStr::new(PENDING))?,
            MAX_SPELLCHECK_BYTES,
        )?
        .0 != bytes
        {
            return Err(attention());
        }
        self.verify_lease(&lease)?;
        fs::renameat(
            &self.store,
            PENDING,
            &self.store,
            SLOTS[(generation % 2) as usize],
        )
        .map_err(syscall_error)?;
        gate(Stage::Replaced)?;
        self.store.sync_all().map_err(io_error)?;
        gate(Stage::DirectorySynced)?;
        self.verify_lease(&lease)?;
        Ok(generation)
    }
}
#[cfg(test)]
#[path = "spellcheck_store_tests.rs"]
mod tests;
