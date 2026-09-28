#[cfg(target_os = "linux")]
fn main() {
    if let Err(error) = history_store_proof::proof::smoke() {
        eprintln!("synthetic history proof failed: {error}");
        std::process::exit(1);
    }
}
#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("M1-05 bundle smoke is Linux-only; platform remains unverified");
    std::process::exit(1);
}
