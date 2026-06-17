const logger = require('electron-log');
const fs = require('fs');
const path = require('path');

let logSavePath = '';
let resetLogFileTaskId = -1;
let currentLogFile = '';

const MAX_LOG_FILES = 30;

export function setLogSavePath(folderPath) {
    logSavePath = folderPath;

    logger.transports.file.level = 'debug';
    logger.transports.file.maxSize = 10 * 1024 * 1024; // 10M max
    logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}'; // file content format
    let date = new Date();
    date = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
    logger.transports.file.fileName = date + '.log'; // file name format 'date.log' (2023-02-01.log)
    logger.transports.file.archiveLog = (oldLog) => {
        const archivePath = path.join(path.dirname(oldLog.path), 'archive');

        // Ensure the archive directory exists.
        if (!fs.existsSync(archivePath)) {
            fs.mkdirSync(archivePath);
        }

        // Move the old log file into the archive directory.
        const newFileName = path.join(archivePath, path.basename(oldLog.path));
        fs.renameSync(oldLog.path, newFileName);

        // Cap the number of archived log files.
        const logFiles = fs.readdirSync(archivePath)
            .filter(file => file.endsWith('.log'))
            .map(file => path.join(archivePath, file));

        if (logFiles.length > MAX_LOG_FILES) {
            // Sort by creation time and delete the oldest.
            logFiles.sort((a, b) => fs.statSync(a).ctime - fs.statSync(b).ctime);
            while (logFiles.length > MAX_LOG_FILES) {
                fs.unlinkSync(logFiles.shift());
            }
        }
    };

    logger.transports.file.async = false;

    let sep = '\\';
    if (process.platform !== 'win32') {
        sep = '/';
    }
    currentLogFile = logSavePath + sep + 'logs' + sep + date + '.log';
    // resolvePathFn replaces the deprecated transports.file.file property.
    logger.transports.file.resolvePathFn = () => currentLogFile;

    const todayStartTime = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    const tmrStartTime = todayStartTime + 24*60*60*1000;
    const resetTime = tmrStartTime - Date.now();

    if (resetLogFileTaskId !== -1) {
        clearTimeout(resetLogFileTaskId);
    }

    resetLogFileTaskId = setTimeout(() => {
        setLogSavePath(folderPath);
    }, resetTime);
}

// 可以将文件放置到指定文件夹中，例如放到安装包文件夹中
// 指定日志文件夹位置

// 有六个日志级别error, warn, info, verbose, debug, silly。默认是silly
export default {
    getLogFilePath() {
        return currentLogFile;
    },
    info(...param) {
        logger.info(JSON.stringify(param));
    },
    warn(...param) {
        logger.warn('%c %s', 'color: yellow', JSON.stringify(param));
    },
    error(...param) {
        logger.error('%c %s', 'color: red', JSON.stringify(param));
    },
    debug(...param) {
        logger.debug(JSON.stringify(param));
    },
    verbose(...param) {
        logger.verbose(JSON.stringify(param));
    },
    silly(...param) {
        logger.silly(JSON.stringify(param));
    }
}
