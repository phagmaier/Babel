//! Narrow Enchant 2 ABI adapter for the existing verified Hunspell provider.
//! No native Learn or persistent platform wordlist mutation; /dev/null is the
//! explicit empty PWL. Raw pointers never leave this worker or cross threads.
use screenwriter_core::documents::spellcheck::{valid_language, valid_word};
use std::ffi::{CStr, CString, c_char, c_int, c_void};
type Describe =
    unsafe extern "C" fn(*const c_char, *const c_char, *const c_char, *const c_char, *mut c_void);
#[link(name = "enchant-2")]
unsafe extern "C" {
    fn enchant_get_version() -> *const c_char;
    fn enchant_broker_init() -> *mut c_void;
    fn enchant_broker_free(b: *mut c_void);
    fn enchant_broker_set_ordering(b: *mut c_void, tag: *const c_char, order: *const c_char);
    fn enchant_broker_list_dicts(b: *mut c_void, describe: Describe, data: *mut c_void);
    fn enchant_broker_request_dict_with_pwl(
        b: *mut c_void,
        tag: *const c_char,
        pwl: *const c_char,
    ) -> *mut c_void;
    fn enchant_broker_free_dict(b: *mut c_void, d: *mut c_void);
    fn enchant_dict_check(d: *mut c_void, word: *const c_char, len: isize) -> c_int;
    fn enchant_dict_suggest(
        d: *mut c_void,
        word: *const c_char,
        len: isize,
        count: *mut usize,
    ) -> *mut *mut c_char;
    fn enchant_dict_free_string_list(d: *mut c_void, list: *mut *mut c_char);
    fn enchant_dict_describe(d: *mut c_void, describe: Describe, data: *mut c_void);
}
// Enchant provider initialization/cache teardown is process-wide. Serialize all
// brokers, including independent host tests, before touching its C ABI.
static ENCHANT: std::sync::Mutex<()> = std::sync::Mutex::new(());
pub struct Broker {
    raw: *mut c_void,
    _guard: std::sync::MutexGuard<'static, ()>,
}
impl Drop for Broker {
    fn drop(&mut self) {
        // SAFETY: init's nonnull broker is owned once and all dictionary borrows ended.
        unsafe { enchant_broker_free(self.raw) }
    }
}
unsafe extern "C" fn describe(
    tag: *const c_char,
    provider: *const c_char,
    _description: *const c_char,
    _file: *const c_char,
    data: *mut c_void,
) {
    if tag.is_null() || provider.is_null() || data.is_null() {
        return;
    }
    // SAFETY: Enchant synchronously supplies valid NUL strings; data is the
    // caller's live Vec and the callback stores only copied, validated strings.
    unsafe {
        if CStr::from_ptr(provider).to_bytes() != b"hunspell" {
            return;
        }
        if let Ok(language) = CStr::from_ptr(tag).to_str()
            && valid_language(language)
        {
            let list = &mut *data.cast::<Vec<String>>();
            if list.len() < 128 && !list.iter().any(|x| x == language) {
                list.push(language.to_owned());
            }
        }
    }
}
impl Broker {
    pub fn new() -> Result<Self, &'static str> {
        let guard = ENCHANT.lock().map_err(|_| "dictionaryUnavailable")?;
        // SAFETY: no parameters; returned pointer is checked and exclusively owned.
        let broker = unsafe { enchant_broker_init() };
        if broker.is_null() {
            return Err("dictionaryUnavailable");
        }
        // SAFETY: live broker and static NUL-terminated strings; selects proven provider.
        unsafe {
            enchant_broker_set_ordering(broker, c"*".as_ptr(), c"hunspell".as_ptr());
        }
        Ok(Self {
            raw: broker,
            _guard: guard,
        })
    }
    pub fn languages(&self) -> Vec<String> {
        let mut list = Vec::<String>::new();
        // SAFETY: callback/data remain alive until synchronous enumeration returns.
        unsafe {
            enchant_broker_list_dicts(self.raw, describe, (&mut list as *mut Vec<String>).cast());
        }
        list.sort();
        // Listing alone is not proof a resource can be loaded.
        list.retain(|language| self.dictionary(language).is_ok());
        list
    }
    pub fn version(&self) -> String {
        // SAFETY: Enchant returns a static NUL string; no source text involved.
        unsafe {
            let p = enchant_get_version();
            if p.is_null() {
                "unknown".into()
            } else {
                CStr::from_ptr(p).to_string_lossy().into_owned()
            }
        }
    }
    pub fn dictionary(&self, language: &str) -> Result<Dictionary<'_>, &'static str> {
        if !valid_language(language) {
            return Err("invalidSpellcheckRequest");
        }
        let tag = CString::new(language).map_err(|_| "invalidSpellcheckRequest")?;
        // SAFETY: broker remains live, validated language, explicit empty PWL.
        // Never opens ordinary system user dictionaries or asks Enchant to write.
        let dict = unsafe {
            enchant_broker_request_dict_with_pwl(self.raw, tag.as_ptr(), c"/dev/null".as_ptr())
        };
        if dict.is_null() {
            return Err("dictionaryUnavailable");
        }
        let result = Dictionary {
            broker: self,
            raw: dict,
        };
        let mut provider = Vec::<String>::new();
        // SAFETY: owned live dictionary and synchronous callback as above.
        unsafe {
            enchant_dict_describe(dict, describe, (&mut provider as *mut Vec<String>).cast());
        }
        if !provider.iter().any(|x| x == language) {
            return Err("dictionaryUnavailable");
        }
        Ok(result)
    }
}
pub struct Dictionary<'a> {
    broker: &'a Broker,
    raw: *mut c_void,
}
impl Drop for Dictionary<'_> {
    fn drop(&mut self) {
        // SAFETY: dictionary belongs to this still-live broker and is freed once.
        unsafe { enchant_broker_free_dict(self.broker.raw, self.raw) }
    }
}
impl Dictionary<'_> {
    pub fn check(&self, word: &str) -> Result<bool, &'static str> {
        if !valid_word(word) {
            return Err("invalidSpellcheckRequest");
        }
        // SAFETY: live dictionary, borrowed UTF-8 with explicit bounded byte length.
        match unsafe { enchant_dict_check(self.raw, word.as_ptr().cast(), word.len() as isize) } {
            0 => Ok(true),
            n if n > 0 => Ok(false),
            _ => Err("dictionaryUnavailable"),
        }
    }
    pub fn suggest(&self, word: &str) -> Result<Vec<String>, &'static str> {
        if !valid_word(word) {
            return Err("invalidSpellcheckRequest");
        }
        let mut count = 0;
        // SAFETY: same word lifetime as check; count points to a live usize.
        let list = unsafe {
            enchant_dict_suggest(
                self.raw,
                word.as_ptr().cast(),
                word.len() as isize,
                &mut count,
            )
        };
        if list.is_null() {
            return Ok(Vec::new());
        }
        let mut suggestions = Vec::new();
        // SAFETY: ABI promises count live NUL strings. Copy at most 8 valid
        // single-word suggestions, then release the entire list exactly once.
        unsafe {
            for at in 0..count.min(64) {
                let p = *list.add(at);
                if p.is_null() {
                    break;
                }
                if let Ok(s) = CStr::from_ptr(p).to_str()
                    && valid_word(s)
                    && !suggestions.iter().any(|x| x == s)
                {
                    suggestions.push(s.to_owned());
                    if suggestions.len() == 8 {
                        break;
                    }
                }
            }
            enchant_dict_free_string_list(self.raw, list);
        }
        Ok(suggestions)
    }
}
