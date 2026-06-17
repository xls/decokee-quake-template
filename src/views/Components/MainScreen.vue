<template>
    <div class="main-screen">
        <div class="top-bar">
            <!-- Select device -->
            <el-dropdown trigger="click" @command="handDeviceSelected">
                <span class="device-link">
                    {{ deviceName }}
                    <el-icon style="margin-left: 5px"><ArrowDown /></el-icon>
                </span>
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item
                            v-for="item in deviceArr"
                            :key="item.serialNumber"
                            :command="item.serialNumber"
                        >
                            {{ item.label }}
                        </el-dropdown-item>
                        <el-dropdown-item v-if="deviceArr.length === 0" disabled>
                            {{ $t('selectDevice') }}
                        </el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown>

            <!-- Settings -->
            <el-button text class="settings-btn" @click="showSettings()">
                <svg-icon color="darkgray" name="settings" style="font-size: 28px" />
            </el-button>
        </div>
    </div>
</template>

<script>
import { ipcRenderer } from 'electron';

export default {
    name: 'MainScreen',
    data() {
        return {
            deviceArr: [],
            serialNumber: '',
            deviceName: this.$t('selectDevice'),
        };
    },
    created() {
        const connected = window.appManager.deviceControlManager.getConnectedDevices();
        if (connected && connected.length > 0) {
            connected.forEach(device =>
                this.processDeviceConnection(device.serialNumber, true, device.connectionType)
            );
        }

        ipcRenderer.on('DeviceConnection', (event, args) => {
            this.processDeviceConnection(args.serialNumber, args.connected, args.connectionType);
        });
    },
    methods: {
        showSettings(showTab) {
            if (window.windowManager.settingWindow.isVisible()) return;
            window.windowManager.settingWindow.changeVisibility(showTab);
        },
        handDeviceSelected(serialNumber) {
            const device = this.deviceArr.find(item => item.serialNumber === serialNumber);
            if (!device) return;
            this.serialNumber = serialNumber;
            this.deviceName = device.label;
            window.store.storeSet('mainscreen.deviceName', this.deviceName);
            window.store.storeSet('currentSelectedDevice', {
                serialNumber: this.serialNumber,
                deviceName: this.deviceName,
            });
        },
        processDeviceConnection(serialNumber, connected, connectionType) {
            // Devices without a usable serial (e.g. plain QMK keyboards) are ignored.
            if (!serialNumber || serialNumber.length < 4) return;
            const serial = serialNumber.substr(serialNumber.length - 4, 4);

            if (connected) {
                if (this.deviceArr.some(item => item.serialNumber === serialNumber)) return;
                const label =
                    connectionType === 'QMK' ? `DecoKee QUAKE ${serial}` : `DecoKee ${serial}`;
                this.deviceArr.push({ label, serialNumber, connectionType });

                // Auto-select the first connected device.
                if (!this.serialNumber) {
                    this.handDeviceSelected(serialNumber);
                }
            } else {
                this.deviceArr = this.deviceArr.filter(item => item.serialNumber !== serialNumber);
                if (this.serialNumber === serialNumber) {
                    this.serialNumber = '';
                    this.deviceName = this.$t('selectDevice');
                    window.store.storeSet('mainscreen.deviceName', this.deviceName);
                    window.store.storeSet('currentSelectedDevice', '');
                }
            }
        },
    },
};
</script>

<style lang="less" scoped>
.main-screen {
    width: 100%;
    height: 100%;
    min-height: calc(100vh - 32px);
    background: #2d3a41;
    position: relative;
}

.top-bar {
    position: absolute;
    top: 14px;
    right: 18px;
    display: flex;
    align-items: center;
    gap: 14px;
}

.device-link {
    color: #fff;
    opacity: 0.85;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    font-size: 14px;
    outline: none;
}

.device-link:hover {
    color: #409eff;
}

.settings-btn {
    padding: 4px;
}
</style>
