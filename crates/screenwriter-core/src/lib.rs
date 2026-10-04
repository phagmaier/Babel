use serde::Serialize;

pub mod documents;

/// Harmless M0 build information; no document or filesystem access.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub platform: &'static str,
}

pub fn app_info() -> AppInfo {
    AppInfo {
        name: "babel",
        version: env!("CARGO_PKG_VERSION"),
        platform: "desktop",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_package_build_information() {
        let info = app_info();
        assert_eq!(info.name, "babel");
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(info.platform, "desktop");
    }
}

#[cfg(all(test, target_os = "linux"))]
#[path = "../../../tests/support/test_root.rs"]
mod test_support;
