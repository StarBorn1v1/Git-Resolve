"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const ink_1 = require("ink");
const ink_select_input_1 = __importDefault(require("ink-select-input"));
const App = () => {
    const [status, setStatus] = (0, react_1.useState)('Checking repository...');
    (0, react_1.useEffect)(() => {
        setStatus('Repository ready (mock)');
    }, []);
    const items = [
        { label: 'View status', value: 'status' },
        { label: 'View changes', value: 'changes' },
        { label: 'Exit', value: 'exit' },
    ];
    const handleSelect = (item) => {
        if (item.value === 'exit') {
            process.exit(0);
        }
    };
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", padding: 1 },
        react_1.default.createElement(ink_1.Box, { borderStyle: "single", borderColor: "blue", padding: 1, marginBottom: 1 },
            react_1.default.createElement(ink_1.Text, { bold: true, color: "cyan" }, "GIT RESOLVE")),
        react_1.default.createElement(ink_1.Text, { color: "gray" }, status),
        react_1.default.createElement(ink_1.Box, { marginTop: 1 },
            react_1.default.createElement(ink_select_input_1.default, { items: items, onSelect: handleSelect }))));
};
exports.default = App;
