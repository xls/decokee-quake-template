import { axios } from './request'
import config from "../../package.json";

/*
 * Update source is USER-CONFIGURED, not hardcoded to the official repo.
 *
 * The user sets their own GitHub (or any) release source in Settings, stored as:
 *   system.updateCheckUrl          -> a JSON endpoint returning { "version": "x.y.z" }
 *                                     (e.g. a raw file in your repo, or a release asset)
 *   system.updateDownloadUrlPrefix -> the download URL prefix the dialog appends the
 *                                     version to (e.g.
 *                                     "https://github.com/<you>/<repo>/releases/download/V")
 *
 * If updateCheckUrl is not set, checkUpdate() is a NO-OP: it returns
 * { haveUpdate: false } and makes no network request. This is the default —
 * the app never contacts the upstream DecoKeeAI repo on its own.
 */

/**
 * @param {object} [storeManager] main-process StoreManager (has storeGet). When
 *   omitted (or no URL configured), this is a no-op returning haveUpdate:false.
 */
export function checkUpdate(storeManager) {
    return new Promise((resolve) => {
        const currentVersion = config.version;

        const checkUpdateUrl = storeManager && storeManager.storeGet
            ? storeManager.storeGet('system.updateCheckUrl', '')
            : '';
        const downloadUrlPrefix = storeManager && storeManager.storeGet
            ? storeManager.storeGet('system.updateDownloadUrlPrefix', '')
            : '';

        // Not configured -> do nothing, no network call.
        if (!checkUpdateUrl) {
            console.log('checkUpdate: no update source configured — skipping.');
            resolve({ haveUpdate: false, version: currentVersion });
            return;
        }

        console.log("checkUpdate: checkUpdateUrl: ", checkUpdateUrl);
        return axios({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            url: checkUpdateUrl,
            method: "GET"
        }).then(async res => {
            console.log("checkUpdate: ", res);

            if (!res || !res.version) {
                resolve({
                    haveUpdate: false,
                    version: currentVersion
                });
                return;
            }

            const latestVersion = res.version;

            if (latestVersion === currentVersion) {
                resolve({
                    haveUpdate: false,
                    version: currentVersion
                });
                return;
            }

            const latestVersionInfo = latestVersion.trim().split('.');
            if (latestVersionInfo.length !== 3) {
                console.log("checkUpdate: Version info not correct. Ignore version check.");
                resolve({
                    haveUpdate: false,
                    version: currentVersion
                });
                return;
            }

            const currentVersionInfo = currentVersion.trim().split('.');

            let cmpResult;
            console.log("checkUpdate: Check for updates: latest: ", latestVersionInfo, " Current: ", currentVersionInfo);
            for (let i = 0; i < 3; i++) {
                cmpResult = parseInt(latestVersionInfo[i]) - parseInt(currentVersionInfo[i]);
                if (cmpResult > 0) {
                    resolve({
                        haveUpdate: true,
                        version: latestVersion,
                        downloadUrlPrefix: downloadUrlPrefix
                    });
                    return;
                } else if (cmpResult < 0) {
                    resolve({
                        haveUpdate: false,
                        version: currentVersion
                    });
                    return;
                }
            }

            resolve({
                haveUpdate: false,
                version: currentVersion
            });
        }).catch(err => {
            console.log('checkUpdate: Detected error', err.message);
            resolve({
                haveUpdate: false,
                version: currentVersion
            });
        });
    });
}
