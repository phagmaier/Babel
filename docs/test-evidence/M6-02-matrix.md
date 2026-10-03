# M6-02 S15.2 current adapter matrix

Linux tmpfs/Btrfs only; synthetic literal fixtures and disposable profiles.
[Commands, outcomes and retained failures](M6.md#m6-02--persistence-interruption-and-operation-investigation).
Injected errors, actual child SIGKILL and actual default-app drills have separate
claims. No physical power loss or controller/cache guarantee.

| Stage/case                       | Current production-path evidence                                                                                                                       | Independent observation                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before temp write                | `source_store_tests::sigkill_boundaries_leave_whole_source_prior_copy_and_discoverable_transaction`: `RecoveryProtected`; recovery child `BeforeWrite` | Literal original remains; checkpointed new source remains recoverable; earlier acknowledged recovery survives                                                                          |
| Partial write                    | Source/recovery deterministic fault matrices and partial-write child barriers                                                                          | Partial candidate/tail is never credited as whole source; old/current literal bytes and previous checkpoint survive                                                                    |
| Sync failure                     | Source/recovery fault-stage matrices; `choices_store_tests::finalize_source_directory_sync_failure_returns_no_receipt`                                 | Injected I/O failures grant no receipt; uncertainty blocks ordinary relinquishment                                                                                                     |
| Before/after replacement         | Source child `BeforeReplace`, `Replaced`, `DirectorySynced`, `Confirmed`                                                                               | Restart whole old/new source, independently specified bytes, previous generation and recoverable new checkpoint                                                                        |
| Disk full                        | `simulated_disk_full_permission_loss_and_directory_substitution_never_replace_source`; recovery ENOSPC simulation                                      | Injected ENOSPC, no host volume exhaustion; only good source/recovery survives                                                                                                         |
| Corrupt/truncated journal        | `recovery_format_tests`, `recovery.rs`, `startup_recovery.rs`                                                                                          | Every second-frame truncation/mutation preserves valid prefix; unknown/newer/quarantined/pending bytes remain untouched                                                                |
| Late acknowledgements            | Full frontend persistence-state/controller/cadence and protected-close contracts                                                                       | Version/hash/session binding; older receipts cannot credit newer live content                                                                                                          |
| External edit                    | Source pre/post-replacement race tests; native `recovery-shutdown` and presentation                                                                    | External/current/live/previous generations remain separate; refused close receives no success credit                                                                                   |
| Second instance                  | `recovery_choices::second_instance_may_compare_but_never_adopt`; native `persistence-two-instances-shared`                                             | Two real owned default apps sharing their persistence store; second read-only/no edit, first writer continues saving after second closes                                               |
| History failure                  | `history_corruption_stops_history_but_not_source_or_recovery`; native `recovery-shutdown`                                                              | Normal source and recovery saving remain available; destructive operations remain guarded                                                                                              |
| Interrupted local restore        | `snapshot_store_tests::sigkill_during_local_restore_retains_disk_live_and_selected_generations`                                                        | Actual restore child killed after original/live safety publication, before replacement and immediately after; restart reads exact original/live/selected snapshots, source and journal |
| Missing/renamed/unavailable path | `source_save::deletion_rename_and_changed_parent_block_source_replacement_but_keep_recovery`; native `persistence-paths`                               | No source recreation; literal moved generation and acknowledged live recovery survive; emergency close/copy adoption and subsequent edit independently verified                        |
| Read-only/permission change      | Native `audit-fixes` and `recovery-shutdown`; source adapter permission tests                                                                          | Read-only Save As/cancel; denied source save does not rewrite original; truthful recovery and emergency copy                                                                           |

Parent-directory rename is an unavailable-drive-path simulation, **not an actual
unmount**. This run does not exhaust a filesystem, cut power, or test a particular
storage controller, antivirus, cloud/sync-folder product or non-Linux adapter.
Generic external edits/locks do not certify such products. Package installation,
full S13, screenreader/manual/owner adoption and C1/F2 remain other open gates.

Save As acceptance requires later edits saved to the copy and Undo restoring its
literal oracle, with the externally changed original untouched. Refusal retains
old editor content and recovery identity, reports the standalone copy and keeps
the case failed. DOM readiness diagnostics record Save/editability, outline
status/filter and trusted composition events; they grant no protection credit.
Historical M6-01 operation failures remain unresolved unless a stage-specific
cause and correction are reproduced. Clean samples are not a causal diagnosis.

Separate app-data roots do not share advisory leases under the pre-existing
[ADR 0012](../decisions/0012-native-document-identity.md) contract. The distinct-
store diagnostic keeps its failed read-only oracle and captures the second
app's actual state; it is not shared-store concurrent-writer acceptance.
