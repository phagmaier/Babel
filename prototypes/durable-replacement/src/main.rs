#[cfg(target_os = "linux")]
fn main() {
    use durable_replacement_proof::linux::{Stage, normal_write, replace};
    use std::io::{self, Write};
    use std::path::PathBuf;

    // Internal worker for integration tests only. A trusted parent owns this
    // directory; not a frontend/native command or general save API.
    let mut args = std::env::args().skip(1);
    let dir = PathBuf::from(args.next().expect("test sandbox directory"));
    let checkpoint = args.next().expect("checkpoint or complete");
    let receipt = replace(
        &dir,
        21,
        |stage: Stage| {
            if format!("{stage:?}") == checkpoint {
                println!("READY {stage:?}");
                io::stdout().flush()?;
                // Parent kills this child once it observes the barrier. No sleep,
                // process destructors, or cleanup run at the interruption point.
                let mut line = String::new();
                io::stdin().read_line(&mut line)?;
            }
            Ok(())
        },
        normal_write,
    );
    match receipt {
        Ok(receipt) => println!("ACK {} {}", receipt.version, receipt.source.len()),
        Err(error) => {
            eprintln!("{error:?}");
            std::process::exit(1);
        }
    }
}

#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("M1-04 proof is Linux-only; this platform remains unverified.");
    std::process::exit(1);
}
