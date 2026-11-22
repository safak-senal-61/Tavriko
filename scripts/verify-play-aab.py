"""Check store-critical fields and 64-bit ELF alignment of the final bundle."""
import json
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def main(bundle, manifest_path):
    manifest = ET.parse(manifest_path).getroot()
    ns = "{http://schemas.android.com/apk/res/android}"
    package = manifest.get("package")
    version_code = int(manifest.attrib[ns + "versionCode"])
    version_name = manifest.attrib[ns + "versionName"]
    target = int(manifest.find("uses-sdk").attrib[ns + "targetSdkVersion"])
    with Path("client/app.json").open() as file:
        expected_version = json.load(file)["expo"]["version"]
    require(package == "com.tavriko.app", "Unexpected Android application ID")
    require(version_code > 16 and version_name == expected_version, "Unexpected Android release version")
    require(target >= 36, "Android target SDK must be at least 36")
    permissions = {node.get(ns + "name") for node in manifest.findall("uses-permission")}
    denied = {"android.permission.RECORD_AUDIO", "android.permission.SYSTEM_ALERT_WINDOW",
              "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"}
    require(not denied.intersection(permissions), f"Unexpected Android permissions: {denied & permissions}")
    require("com.google.android.gms.permission.AD_ID" in permissions, "Missing AD_ID permission")
    require(manifest.find("application").get(ns + "usesCleartextTraffic") != "true",
            "Release must not allow cleartext traffic")
    counts = {"arm64-v8a": 0, "x86_64": 0}
    with ZipFile(bundle) as archive, tempfile.TemporaryDirectory() as temp:
        so = Path(temp) / "check.so"
        for entry in archive.infolist():
            path = entry.filename.split("/")
            if len(path) != 4 or path[1] != "lib" or path[2] not in counts or not path[3].endswith(".so"):
                continue
            so.write_bytes(archive.read(entry))
            headers = subprocess.check_output(["readelf", "-lW", str(so)], text=True)
            loads = [line.split()[-1] for line in headers.splitlines() if line.strip().startswith("LOAD ")]
            require(loads and all(int(alignment, 16) >= 16384 for alignment in loads),
                    f"16 KB ELF alignment failed: {entry.filename}")
            counts[path[2]] += 1
    require(counts["arm64-v8a"] > 0, "No ARM64 libraries found in release bundle")
    print(f"Package: {package}; versionName: {version_name}; versionCode: {version_code}; target SDK: {target}")
    print(f"16 KB ELF alignment verified: {counts}")
    print(f"Merged Android permissions: {', '.join(sorted(permissions))}")


if __name__ == "__main__":
    main(*sys.argv[1:])
