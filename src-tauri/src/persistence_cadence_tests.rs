//! M3-10 native cadence harness. Real Linux files behind the serialized
//! writer; measures checkpoint/save acknowledgement latency under synthetic
//! continuous typing. Numbers are engineering observations against the S10.3
//! targets, never power-loss guarantees. Set BABEL_CADENCE_REPORT to write a
//! JSON report; fixtures live under BABEL_IPC_TEST_ROOT or the system temp dir.
use super::*;
use crate::test_support::TestRoot;
use screenwriter_core::documents::{
    persistence::CheckpointRequest, recovery::source_hash, saving::SaveRequest,
};
use std::{fs, os::unix::fs::MetadataExt, time::Instant};

struct Fixture(TestRoot);
impl Fixture {
    fn new() -> Self {
        let root = TestRoot::new("BABEL_IPC_TEST_ROOT", "babel-cadence");
        root.write("source.fountain", b"INT. HOUSE - DAY\n", 0o600);
        Self(root)
    }
}

fn stats(mut samples: Vec<f64>) -> serde_json::Value {
    samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let at = |q: f64| samples[((q * samples.len() as f64) as usize).min(samples.len() - 1)];
    serde_json::json!({
        "n": samples.len(),
        "minMs": samples[0],
        "p50Ms": at(0.5),
        "p95Ms": at(0.95),
        "maxMs": samples[samples.len() - 1],
    })
}

#[test]
fn continuous_typing_checkpoint_and_save_latency() {
    let f = Fixture::new();
    let mut service = DocumentService::new(&f.0.join("app-data")).unwrap();
    let opened = service.open_selected(&f.0.join("source.fountain")).unwrap();
    let mut checkpoint_ms = Vec::new();
    let mut save_ms = Vec::new();
    let mut fingerprint = opened.fingerprint.clone().unwrap();
    for version in 1u64..=40 {
        let source = format!("INT. SCENE {version} - DAY\nAction line {version}.\n").into_bytes();
        let started = Instant::now();
        let receipt = service
            .checkpoint_request(CheckpointRequest {
                identity: opened.identity.clone(),
                version,
                source: source.clone(),
                source_sha256: source_hash(&source),
                expected_fingerprint: Some(fingerprint.clone()),
                draft_metadata: serde_json::json!({"cadence": "typing"}),
            })
            .unwrap();
        checkpoint_ms.push(started.elapsed().as_secs_f64() * 1000.0);
        assert_eq!(receipt.version, version);
        assert_eq!(receipt.source_sha256, source_hash(&source));
        if version % 4 == 0 {
            let started = Instant::now();
            let saved = service
                .save_request(SaveRequest {
                    identity: opened.identity.clone(),
                    version,
                    source: source.clone(),
                    source_sha256: source_hash(&source),
                    expected_fingerprint: fingerprint.clone(),
                    draft_metadata: serde_json::json!({"cadence": "typing"}),
                })
                .unwrap();
            save_ms.push(started.elapsed().as_secs_f64() * 1000.0);
            assert_eq!(saved.version, version);
            assert_eq!(saved.source_sha256, source_hash(&source));
            assert_eq!(saved.fingerprint.sha256, source_hash(&source));
            fingerprint = saved.fingerprint.clone();
        }
    }
    let final_source = b"INT. SCENE 40 - DAY\nAction line 40.\n".to_vec();
    assert_eq!(fs::read(f.0.join("source.fountain")).unwrap(), final_source);
    // Explicit duplicate save verifies a fresh flush without replacement.
    let duplicate_source = final_source;
    let inode = fs::metadata(f.0.join("source.fountain")).unwrap().ino();
    let first = service
        .save_request(SaveRequest {
            identity: opened.identity.clone(),
            version: 40,
            source: duplicate_source.clone(),
            source_sha256: source_hash(&duplicate_source),
            expected_fingerprint: fingerprint.clone(),
            draft_metadata: serde_json::json!({"cadence": "typing"}),
        })
        .unwrap();
    let second = service
        .save_request(SaveRequest {
            identity: opened.identity.clone(),
            version: 40,
            source: duplicate_source.clone(),
            source_sha256: source_hash(&duplicate_source),
            expected_fingerprint: first.fingerprint.clone(),
            draft_metadata: serde_json::json!({"cadence": "typing"}),
        })
        .unwrap();
    assert_eq!(first, second);
    assert_eq!(
        fs::metadata(f.0.join("source.fountain")).unwrap().ino(),
        inode
    );
    for sample in checkpoint_ms.iter().chain(save_ms.iter()) {
        assert!(*sample < 30_000.0, "cadence ack took {sample} ms");
    }
    if let Some(report) = std::env::var_os("BABEL_CADENCE_REPORT") {
        fs::write(
            report,
            serde_json::to_string_pretty(&serde_json::json!({
                "versions": 40,
                "saves": save_ms.len(),
                "checkpointMs": stats(checkpoint_ms),
                "saveMs": stats(save_ms),
                "duplicateFlushEqual": true,
                "duplicateFlushSameInode": true,
            }))
            .unwrap(),
        )
        .unwrap();
    }
}
