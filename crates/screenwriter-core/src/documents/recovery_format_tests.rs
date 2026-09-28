use super::*;

fn identity() -> DocumentRequest {
    DocumentRequest {
        handle: "11111111-1111-4111-8111-111111111111".into(),
        document_id: "22222222-2222-4222-8222-222222222222".into(),
        session_id: "33333333-3333-4333-8333-333333333333".into(),
    }
}

fn record(version: u64, source: &[u8]) -> Checkpoint {
    Checkpoint::capture(
        &identity(),
        version,
        version,
        source,
        serde_json::json!({"emptyBlock":"dialogue","selection":[2,3]}),
    )
    .unwrap()
}

#[test]
fn layout_hash_raw_bytes_and_draft_metadata_round_trip() {
    let checkpoint = record(21, b"\xef\xbb\xbf@\r\n  \xff[[unfinished");
    let bytes = checkpoint.encode().unwrap();
    assert_eq!(&bytes[..12], b"BBLREC01\x01\x00\x00\x00");
    assert_eq!(
        u64::from_le_bytes(bytes[16..24].try_into().unwrap()),
        checkpoint.source.len() as u64
    );
    let decoded = decode_journal(&bytes);
    assert_eq!(decoded.tail, TailStatus::Clean);
    assert_eq!(decoded.checkpoints, vec![checkpoint]);
    assert_eq!(decoded.valid_bytes, bytes.len());
    assert_eq!(
        source_hash(b"abc"),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
}

#[test]
fn every_truncation_of_second_frame_retains_the_first_checkpoint() {
    let first = record(1, b"first\r\n");
    let prefix = first.encode().unwrap();
    let second = record(2, b"second\xff\n").encode().unwrap();
    for len in 1..second.len() {
        let mut bytes = prefix.clone();
        bytes.extend_from_slice(&second[..len]);
        let result = decode_journal(&bytes);
        assert_eq!(result.checkpoints, vec![first.clone()], "cut {len}");
        assert_eq!(result.valid_bytes, prefix.len());
        assert_eq!(result.tail, TailStatus::Truncated);
    }
}

#[test]
fn every_single_byte_mutation_of_second_frame_keeps_prior_valid_record() {
    let first = record(1, b"first");
    let prefix = first.encode().unwrap();
    let second = record(2, b"second").encode().unwrap();
    for index in 0..second.len() {
        let mut damaged = second.clone();
        damaged[index] ^= 0x80;
        let mut bytes = prefix.clone();
        bytes.extend_from_slice(&damaged);
        let result = decode_journal(&bytes);
        assert_eq!(result.checkpoints, vec![first.clone()], "byte {index}");
        assert_ne!(result.tail, TailStatus::Clean);
    }
}

#[test]
fn unknown_schema_lengths_and_nonmonotonic_records_stop_without_resynchronizing() {
    let first = record(1, b"first");
    let prefix = first.encode().unwrap();
    let mut future = record(2, b"second").encode().unwrap();
    future[8..12].copy_from_slice(&2u32.to_le_bytes());
    let mut bytes = prefix.clone();
    bytes.extend_from_slice(&future);
    assert_eq!(decode_journal(&bytes).tail, TailStatus::UnsupportedSchema);
    future[8..12].copy_from_slice(&1u32.to_le_bytes());
    future[16..24].copy_from_slice(&u64::MAX.to_le_bytes());
    let mut bytes = prefix.clone();
    bytes.extend_from_slice(&future);
    assert_eq!(decode_journal(&bytes).tail, TailStatus::TooLarge);
    let mut bytes = prefix;
    bytes.extend_from_slice(&first.encode().unwrap());
    let result = decode_journal(&bytes);
    assert_eq!(result.checkpoints, vec![first]);
    assert_eq!(result.tail, TailStatus::Corrupt);
}

#[test]
fn malformed_random_buffers_are_bounded_and_do_not_panic() {
    let mut seed: u64 = 0x5a39_2bef;
    for len in 0..512 {
        let bytes: Vec<_> = (0..len)
            .map(|_| {
                seed ^= seed << 13;
                seed ^= seed >> 7;
                seed ^= seed << 17;
                seed as u8
            })
            .collect();
        let decoded = decode_journal(&bytes);
        assert!(decoded.checkpoints.is_empty());
        assert_eq!(decoded.valid_bytes, 0);
    }
}

#[test]
fn invalid_identity_version_hash_and_metadata_bounds_are_rejected() {
    let mut id = identity();
    id.document_id = "../escape".into();
    assert!(Checkpoint::capture(&id, 1, 1, b"abc", serde_json::Value::Null).is_err());
    for version in [0, MAX_VERSION + 1, u64::MAX] {
        assert!(
            Checkpoint::capture(&identity(), version, 1, b"abc", serde_json::Value::Null).is_err()
        );
    }
    let mut bad = record(1, b"abc");
    bad.metadata.source_sha256 = "wrong".into();
    assert!(bad.encode().is_err());
    let mut bad = record(1, b"abc");
    bad.metadata.draft_metadata = serde_json::json!("x".repeat(MAX_DRAFT_METADATA_BYTES));
    assert!(bad.encode().is_err());
}

#[test]
fn recomputed_frame_checksum_does_not_bypass_native_source_hash_validation() {
    let good = record(1, b"abc");
    let mut bytes = good.encode().unwrap();
    let hash = good.metadata.source_sha256.as_bytes();
    let position = bytes
        .windows(hash.len())
        .position(|window| window == hash)
        .unwrap();
    bytes[position] = b'0';
    let body_len = bytes.len() - CHECKSUM_BYTES;
    let checksum = Sha256::digest(&bytes[..body_len]);
    bytes[body_len..].copy_from_slice(&checksum);
    let decoded = decode_journal(&bytes);
    assert!(decoded.checkpoints.is_empty());
    assert_eq!(decoded.tail, TailStatus::Corrupt);
}
