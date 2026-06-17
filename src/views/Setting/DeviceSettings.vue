<template>
    <div class="device-settings">
        <el-form v-if="deviceArr.length > 0" label-width="160px" size="small">
            <el-form-item label="Device">
                <el-select v-model="serialNumber" @change="onDeviceChange">
                    <el-option
                        v-for="item in deviceArr"
                        :key="item.serialNumber"
                        :label="item.label"
                        :value="item.serialNumber"
                    ></el-option>
                </el-select>
            </el-form-item>

            <el-form-item label="Firmware version">
                <span>{{ state.version || '--' }}</span>
            </el-form-item>

            <el-form-item label="Brightness">
                <el-slider
                    v-model="state.brightness"
                    :min="0"
                    :max="255"
                    :disabled="state.brightness === null"
                    @change="onBrightnessChange"
                    style="width: 240px"
                />
            </el-form-item>

            <el-form-item label="Microphone">
                <el-switch v-model="state.mic" @change="onMicChange" />
            </el-form-item>

            <el-form-item label="Buzzer">
                <el-switch v-model="state.buzzer" @change="onBuzzerChange" />
            </el-form-item>

            <el-form-item label="Firmware update">
                <el-button type="warning" @click="onEnterDownloadMode">
                    Enter download mode
                </el-button>
            </el-form-item>
        </el-form>

        <div v-else class="no-device">No QUAKE device connected.</div>
    </div>
</template>

<script>
import { ElMessageBox } from 'element-plus';

export default {
    name: 'DeviceSettings',
    data() {
        return {
            deviceArr: [],
            serialNumber: '',
            state: { version: null, brightness: null, mic: false, buzzer: false },
        };
    },
    created() {
        this.$nextTick(() => {
            this._focusHandler = () => this.loadDevices();
            window.addEventListener('focus', this._focusHandler);
        });
        this.loadDevices();
    },
    beforeUnmount() {
        if (this._focusHandler) window.removeEventListener('focus', this._focusHandler);
        clearTimeout(this._refreshTimer);
    },
    computed: {
        dcm() {
            return window.appManager.deviceControlManager;
        },
    },
    methods: {
        loadDevices() {
            this.deviceArr = this.dcm.getQuakeDevices() || [];
            if (this.deviceArr.length === 0) {
                this.serialNumber = '';
                return;
            }
            // Keep the current selection if still connected, else pick the first.
            if (!this.deviceArr.find(d => d.serialNumber === this.serialNumber)) {
                this.serialNumber = this.deviceArr[0].serialNumber;
            }
            this.loadState();
        },
        onDeviceChange() {
            this.loadState();
        },
        loadState() {
            if (!this.serialNumber) return;
            // Read the cached state immediately, then refresh from the device and
            // re-read once the queries have come back.
            this.readState();
            this.dcm.refreshQuakeState(this.serialNumber);
            clearTimeout(this._refreshTimer);
            this._refreshTimer = setTimeout(() => this.readState(), 400);
        },
        readState() {
            const s = this.dcm.getQuakeState(this.serialNumber);
            if (!s) return;
            this.state = {
                version: s.version,
                brightness: s.brightness === null ? 0 : s.brightness,
                mic: !!s.mic,
                buzzer: s.buzzer === null ? false : !!s.buzzer,
            };
        },
        onBrightnessChange(value) {
            this.dcm.setQuakeBrightness(this.serialNumber, value);
        },
        onMicChange(value) {
            this.dcm.setQuakeMic(this.serialNumber, value);
        },
        onBuzzerChange(value) {
            this.dcm.setQuakeBuzzer(this.serialNumber, value);
        },
        onEnterDownloadMode() {
            ElMessageBox.confirm(
                'The device will reboot into firmware download mode and disconnect. Continue?',
                'Enter download mode',
                { confirmButtonText: 'Continue', cancelButtonText: 'Cancel', type: 'warning' }
            )
                .then(() => {
                    this.dcm.enterQuakeDownloadMode(this.serialNumber);
                })
                .catch(() => {});
        },
    },
};
</script>

<style lang="less" scoped>
.device-settings {
    padding-top: 20px;
}

.no-device {
    padding: 40px 20px;
    color: #aaa;
    text-align: center;
}

:deep(.el-form-item__label) {
    color: #fff;
}

:deep(.el-input__inner) {
    background: #2e3a41;
}
</style>
