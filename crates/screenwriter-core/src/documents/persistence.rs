//! Strict path-free persistence envelopes shared with the desktop command boundary.
use super::{DiskFingerprint, DocumentError, DocumentRequest, ErrorCode, MAX_SOURCE_BYTES};
use serde::{
    Deserialize, Deserializer, Serialize,
    de::{self, SeqAccess, Visitor},
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CheckpointRequest {
    #[serde(deserialize_with = "native_identity")]
    pub identity: DocumentRequest,
    pub version: u64,
    #[serde(deserialize_with = "source_bytes")]
    pub source: Vec<u8>,
    pub source_sha256: String,
    pub expected_fingerprint: Option<DiskFingerprint>,
    pub draft_metadata: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointFailure {
    pub identity: DocumentRequest,
    pub version: u64,
    pub error: DocumentError,
}

pub(super) fn native_identity<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<DocumentRequest, D::Error> {
    let identity = DocumentRequest::deserialize(deserializer)?;
    for value in [
        &identity.handle,
        &identity.document_id,
        &identity.session_id,
    ] {
        if value.len() != 36
            || !uuid::Uuid::parse_str(value)
                .is_ok_and(|id| !id.is_nil() && id.to_string() == *value)
        {
            // Never reflect arbitrary caller strings in a structured failure's identity fields.
            return Err(de::Error::custom("invalid native document identity"));
        }
    }
    Ok(identity)
}

// Tauri's JSON transport has already parsed the body; bound the additional typed byte allocation.
// This is not a claim of a bounded transport parser or a universal IPC message-size limit.
pub(super) fn source_bytes<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Vec<u8>, D::Error> {
    struct Bytes;
    impl<'de> Visitor<'de> for Bytes {
        type Value = Vec<u8>;
        fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str("a bounded byte array")
        }
        fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Vec<u8>, A::Error> {
            let mut bytes = Vec::with_capacity(seq.size_hint().unwrap_or(0).min(MAX_SOURCE_BYTES));
            while let Some(byte) = seq.next_element::<u8>()? {
                if bytes.len() == MAX_SOURCE_BYTES {
                    return Err(de::Error::custom("source payload too large"));
                }
                bytes.push(byte);
            }
            Ok(bytes)
        }
    }
    deserializer.deserialize_seq(Bytes)
}

/// Cheap admission checks, not a native hash/encoding/ownership verification or persistence receipt.
/// The payload is owned by an admitted worker; do not hash or write on the async runtime thread.
pub fn payload_cost(
    version: u64,
    source: &[u8],
    sha256: &str,
    metadata: &serde_json::Value,
) -> Result<usize, DocumentError> {
    if version == 0
        || version > super::recovery::MAX_VERSION
        || source.len() > MAX_SOURCE_BYTES
        || sha256.len() != 64
        || !sha256
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err(DocumentError::new(ErrorCode::InvalidCheckpoint));
    }
    let metadata_bytes = serde_json::to_vec(metadata)
        .map_err(|_| DocumentError::new(ErrorCode::InvalidCheckpoint))?
        .len();
    if metadata_bytes > super::recovery::MAX_DRAFT_METADATA_BYTES - 2048 {
        return Err(DocumentError::new(ErrorCode::InvalidCheckpoint));
    }
    Ok(source.len() + metadata_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::documents::{recovery::source_hash, saving::SaveRequest};
    use serde_json::json;
    fn envelope() -> serde_json::Value {
        json!({"identity":{"handle":"11111111-1111-4111-8111-111111111111","documentId":"22222222-2222-4222-8222-222222222222","sessionId":"33333333-3333-4333-8333-333333333333"},"version":21,"source":[0,255,13,10],"sourceSha256":source_hash(&[0,255,13,10]),"expectedFingerprint":null,"draftMetadata":{"unknown":{"keep":true}}})
    }
    #[test]
    fn strict_envelope_preserves_raw_bytes_unknown_metadata_and_rejects_extra_fields() {
        let value = envelope();
        let checkpoint: CheckpointRequest = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(checkpoint.source, [0, 255, 13, 10]);
        assert_eq!(serde_json::to_value(&checkpoint).unwrap(), value);
        for nested in [false, true] {
            let mut extra = value.clone();
            if nested {
                extra["identity"]["path"] = json!("/not-authorized");
            } else {
                extra["path"] = json!("/not-authorized");
            }
            assert!(serde_json::from_value::<CheckpointRequest>(extra.clone()).is_err());
            assert!(serde_json::from_value::<SaveRequest>(extra).is_err());
        }
        let mut save = value.clone();
        save["expectedFingerprint"] = json!({"device":"1","inode":"2","byteLength":4,"sha256":checkpoint.source_sha256,
            "modifiedSeconds":1,"modifiedNanos":0,"changedSeconds":1,"changedNanos":0,"mode":0o100600,"owner":1000,"links":1});
        let parsed: SaveRequest = serde_json::from_value(save.clone()).unwrap();
        assert_eq!(serde_json::to_value(parsed).unwrap(), save);
        for field in ["path", "destination"] {
            let mut extra = save.clone();
            extra[field] = json!("/private/not-authorized");
            assert!(serde_json::from_value::<SaveRequest>(extra).is_err());
        }
        let mut invalid_identity = save;
        invalid_identity["identity"]["handle"] = json!("/private/manuscript");
        let failure = serde_json::from_value::<SaveRequest>(invalid_identity)
            .unwrap_err()
            .to_string();
        assert!(!failure.contains("/private/manuscript"));
        for invalid in [json!(-1), json!(256), json!(0.5), json!("text")] {
            let mut bad = value.clone();
            bad["source"] = json!([invalid]);
            assert!(serde_json::from_value::<CheckpointRequest>(bad).is_err());
        }
    }
    #[test]
    fn typed_byte_deserialization_is_bounded_even_with_no_trustworthy_size_hint() {
        let seq = serde::de::value::SeqDeserializer::<_, serde::de::value::Error>::new(
            std::iter::repeat_n(0u8, MAX_SOURCE_BYTES + 1),
        );
        assert!(source_bytes(seq).is_err());
        assert!(payload_cost(0, b"", &source_hash(b""), &json!({})).is_err());
        assert!(
            payload_cost(
                super::super::recovery::MAX_VERSION + 1,
                b"",
                &source_hash(b""),
                &json!({})
            )
            .is_err()
        );
        assert!(payload_cost(1, b"", &"0".repeat(63), &json!({})).is_err());
        assert!(payload_cost(1, b"", &source_hash(b""), &json!("x".repeat(64 * 1024))).is_err());
    }
}
