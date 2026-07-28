"[project]/app/client/report/legacy-page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ReportTestPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
/**
 * Lab Report Page
 *
 * Displays lab results for the authenticated patient.
 * Patient is identified from the Supabase Auth session (via magic link).
 * Does NOT use URL parameters for patient identification (secure).
 *
 * This page reuses the same UI components as /client/report but fetches
 * real data from the database.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$legacy$2d$report$2d$bio$2d$marker$2d$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/client/legacy-report-bio-marker-card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$legacy$2d$report$2d$section$2d$summary$2d$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/client/legacy-report-section-summary-card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$legacy$2d$report$2d$bio$2d$marker$2d$item$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/client/legacy-report-bio-marker-item.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$legacy$2d$report$2d$biomarker$2d$modal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/client/legacy-report-biomarker-modal.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$legacy$2d$report$2d$profile$2d$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/client/legacy-report-profile-card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$constants$2f$mock$2d$report$2d$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/client/constants/mock-report-data.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$constants$2f$category$2d$mapping$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/client/constants/category-mapping.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$constants$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/components/client/constants/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-alert.js [app-client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$actions$2f$data$3a$2127f5__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/app/actions/data:2127f5 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$actions$2f$data$3a$f8e0b2__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/app/actions/data:f8e0b2 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$actions$2f$data$3a$085729__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/app/actions/data:085729 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$sex$2d$prompt$2d$modal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/client/sex-prompt-modal.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
// Generate a URL-friendly slug from category name
function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
// Reverse lookup: find category name from slug
function findCategoryBySlug(slug) {
    const category = __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$constants$2f$category$2d$mapping$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CATEGORY_ORDER"].find((cat)=>slugify(cat) === slug);
    return category || null;
}
// Calculate section grade based on which status has highest count
// A (green) = Optimal, B (yellow) = In Range, C (violet) = Out of Range
function calculateSectionGrade(category) {
    const optimal = category.results.filter((r)=>r.status === "OK").length;
    const inRange = category.results.filter((r)=>r.status === "BORDERLINE").length;
    const outOfRange = category.results.filter((r)=>r.status === "HIGH" || r.status === "LOW" || r.status === "CRITICAL").length;
    if (optimal >= inRange && optimal >= outOfRange) {
        return {
            letter: "A",
            color: "#59bf86"
        }; // Green - Optimal
    } else if (inRange >= outOfRange) {
        return {
            letter: "B",
            color: "#e0d834"
        }; // Yellow - In Range
    } else {
        return {
            letter: "C",
            color: "#ee71db"
        }; // Violet - Out of Range
    }
}
// Transform metric result to biomarker item props
function mapStatusToShortLabel(status) {
    switch(status){
        case "OK":
            return "Optimal";
        case "BORDERLINE":
            return "In range";
        case "HIGH":
        case "LOW":
        case "CRITICAL":
            return "Out of range";
        default:
            return "In range";
    }
}
function transformMetricToBiomarker(metric, categoryName) {
    return {
        title: metric.metricName,
        subtitle: categoryName ?? metric.metricCode,
        badge: {
            text: mapStatusToShortLabel(metric.status),
            color: (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$constants$2f$mock$2d$report$2d$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getStatusBadgeColor"])(metric.status)
        },
        value: metric.value.toString(),
        unit: metric.unit,
        whatThisMeans: metric.whatThisMeans,
        refLow: "refLow" in metric ? metric.refLow : undefined,
        refHigh: metric.refHigh,
        trendDirection: "trendDirection" in metric ? metric.trendDirection : null,
        trendMagnitude: "trendMagnitude" in metric ? metric.trendMagnitude : undefined,
        trendValues: "trendValues" in metric ? metric.trendValues : undefined,
        trendDates: "trendDates" in metric ? metric.trendDates : undefined,
        ranges: "ranges" in metric ? metric.ranges : undefined
    };
}
// Loading component
function LoadingState() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col items-center justify-center min-h-[60vh] gap-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                className: "h-12 w-12 animate-spin text-brand"
            }, void 0, false, {
                fileName: "[project]/app/client/report/legacy-page.tsx",
                lineNumber: 141,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-lg text-muted-foreground",
                children: "Loading lab report..."
            }, void 0, false, {
                fileName: "[project]/app/client/report/legacy-page.tsx",
                lineNumber: 142,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/client/report/legacy-page.tsx",
        lineNumber: 140,
        columnNumber: 5
    }, this);
}
_c = LoadingState;
// Error component
function ErrorState({ message }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col items-center justify-center min-h-[60vh] gap-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                className: "h-12 w-12 text-red-500"
            }, void 0, false, {
                fileName: "[project]/app/client/report/legacy-page.tsx",
                lineNumber: 151,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-lg text-red-600",
                children: message
            }, void 0, false, {
                fileName: "[project]/app/client/report/legacy-page.tsx",
                lineNumber: 152,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm text-muted-foreground",
                children: "Please use the magic link from your email to access your results."
            }, void 0, false, {
                fileName: "[project]/app/client/report/legacy-page.tsx",
                lineNumber: 153,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/client/report/legacy-page.tsx",
        lineNumber: 150,
        columnNumber: 5
    }, this);
}
_c1 = ErrorState;
// Main content component - gets patient from authenticated session
function ReportTestContent() {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [labReport, setLabReport] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [scores, setScores] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isLoading, setIsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [authChecked, setAuthChecked] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // On the base /client/report page, the active marker is always Summary.
    const selectedCategory = "summary";
    const [isFilterOpen, setIsFilterOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Modal state
    const [isModalOpen, setIsModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [selectedBiomarker, setSelectedBiomarker] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Sex prompt modal state
    const [showSexPrompt, setShowSexPrompt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [sexChecked, setSexChecked] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Handle magic link auth callback - exchange hash token for session
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ReportTestContent.useEffect": ()=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createClient"])();
            // Check if there's a hash with access_token (magic link callback)
            const hash = window.location.hash;
            if (hash && hash.includes("access_token")) {
                // Parse the hash to extract tokens
                const hashParams = new URLSearchParams(hash.substring(1));
                const accessToken = hashParams.get("access_token");
                const refreshToken = hashParams.get("refresh_token");
                if (accessToken && refreshToken) {
                    // Manually set the session from the hash tokens
                    supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    }).then({
                        "ReportTestContent.useEffect": ({ data, error })=>{
                            if (error) {
                                console.error("Auth callback error:", error);
                                setError("Authentication failed. Please try clicking the link again.");
                                setIsLoading(false);
                                return;
                            }
                            if (data.session) {
                                // Clear the hash from URL for cleaner display, but preserve search params (like ?sid=)
                                window.history.replaceState(null, "", window.location.pathname + window.location.search);
                                console.log("Session established:", data.session.user.email);
                            }
                            setAuthChecked(true);
                        }
                    }["ReportTestContent.useEffect"]);
                } else {
                    setAuthChecked(true);
                }
            } else {
                // No hash, check if already authenticated
                setAuthChecked(true);
            }
        }
    }["ReportTestContent.useEffect"], []);
    // Fetch lab report data after auth is checked
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ReportTestContent.useEffect": ()=>{
            if (!authChecked) return;
            async function fetchData() {
                setIsLoading(true);
                setError(null);
                // No patientId needed - server action gets it from authenticated session
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$actions$2f$data$3a$2127f5__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["getClientLabReport"])();
                if (result.success && result.data) {
                    setLabReport(result.data);
                    // Fetch scores for this lab order
                    const scoresResult = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$actions$2f$data$3a$f8e0b2__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["getClientScores"])(result.data.id);
                    if (scoresResult.success && scoresResult.data) {
                        setScores(scoresResult.data);
                    }
                } else {
                    setError(result.error || "Failed to load lab report");
                }
                setIsLoading(false);
            }
            fetchData();
        }
    }["ReportTestContent.useEffect"], [
        authChecked
    ]);
    // Check if patient sex is missing and show prompt
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ReportTestContent.useEffect": ()=>{
            if (!authChecked || sexChecked) return;
            async function checkSex() {
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$actions$2f$data$3a$085729__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["getPatientSexStatus"])();
                if (result.success && result.data && result.data.sex === null) {
                    // Sex is missing, show prompt
                    setShowSexPrompt(true);
                }
                setSexChecked(true);
            }
            checkSex();
        }
    }["ReportTestContent.useEffect"], [
        authChecked,
        sexChecked
    ]);
    // Handle sex prompt success - reload the page to get updated reference ranges
    const handleSexPromptSuccess = ()=>{
        setShowSexPrompt(false);
        // Reload to get updated reference ranges with the new sex
        window.location.reload();
    };
    // Build categories from lab report data with grade-based letters
    const categories = labReport ? [
        {
            id: "summary",
            label: "Summary",
            color: "#59bf86",
            letter: "A",
            sectionId: "profile"
        },
        ...__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$constants$2f$category$2d$mapping$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CATEGORY_ORDER"].slice(1).map((categoryName)=>{
            // Find matching category in report data or create placeholder
            const reportCategory = labReport.structured_data.findings.categories.find((cat)=>cat.category === categoryName);
            const grade = reportCategory ? calculateSectionGrade(reportCategory) : {
                color: "#e0d834",
                letter: "B"
            }; // Default for empty categories
            return {
                id: slugify(categoryName),
                label: categoryName,
                color: grade.color,
                letter: grade.letter,
                sectionId: slugify(categoryName)
            };
        })
    ] : [];
    // Create section to category map
    const sectionToCategoryMap = {};
    categories.forEach((cat)=>{
        sectionToCategoryMap[cat.sectionId] = cat.id;
    });
    // Transform metric to modal format
    const metricToModal = (metric)=>{
        const statusLabel = mapStatusToShortLabel(metric.status);
        let color = "#22C55E";
        if (statusLabel === "In range") color = "#FDE047";
        if (statusLabel === "Out of range") color = "#EF4444";
        // Build OPTIMAL range string from actual optimal values
        const optimalLow = "optimalLow" in metric ? metric.optimalLow : undefined;
        const optimalHigh = "optimalHigh" in metric ? metric.optimalHigh : undefined;
        let range;
        if (optimalLow !== undefined && optimalHigh !== undefined) {
            // Both optimal bounds available
            range = `${optimalLow} - ${optimalHigh}`;
        } else if (optimalHigh !== undefined) {
            // Only upper bound (lower is better)
            range = `< ${optimalHigh}`;
        } else if (optimalLow !== undefined) {
            // Only lower bound (higher is better)
            range = `> ${optimalLow}`;
        } else {
            // No optimal data available - show N/A
            range = "N/A";
        }
        // Build REFERENCE range string from ref values
        const refLow = "refLow" in metric ? metric.refLow : undefined;
        const refHigh = "refHigh" in metric ? metric.refHigh : undefined;
        let referenceRange;
        if (refLow !== undefined && refLow !== 0 && refHigh !== undefined && refHigh !== 999) {
            // Both ref bounds available and not defaults
            referenceRange = `${refLow} - ${refHigh}`;
        } else if (refHigh !== undefined && refHigh !== 999) {
            // Only upper bound
            referenceRange = `< ${refHigh}`;
        } else if (refLow !== undefined && refLow !== 0) {
            // Only lower bound
            referenceRange = `> ${refLow}`;
        }
        // If both are defaults (0/999), referenceRange stays undefined
        return {
            name: metric.metricName,
            description: metric.whatThisMeans || "No description available",
            value: parseFloat(metric.value.toString()),
            unit: metric.unit,
            status: statusLabel,
            color,
            range,
            referenceRange,
            trendValues: metric.trendValues,
            trendDates: metric.trendDates,
            ranges: metric.ranges
        };
    };
    // Get chronological age safely before hooks (labReport may be null during loading)
    // Use scores?.chronologicalAge as primary source for consistency with home page
    const chronologicalAge = scores?.chronologicalAge ?? labReport?.structured_data.patient.age;
    // Transform score card data to modal format
    const scoreToModal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ReportTestContent.useCallback[scoreToModal]": (scoreType)=>{
            if (scoreType === "health") {
                const healthScoreValue = scores?.healthScore ?? 0;
                return {
                    name: "Health Score",
                    description: "Your overall health snapshot based on key biomarkers.",
                    value: healthScoreValue,
                    unit: "points",
                    status: healthScoreValue >= 70 ? "Optimal" : "Needs Improvement",
                    color: healthScoreValue >= 70 ? "#22C55E" : "#FDE047",
                    range: "70 - 100"
                };
            } else {
                const age = chronologicalAge ?? 0;
                const biologicalAgeValue = scores?.biologicalAge ?? age;
                const ageDiff = age - biologicalAgeValue;
                return {
                    name: "Biological Age (PhenoAge)",
                    description: "How your body is aging at a cellular level.",
                    value: biologicalAgeValue,
                    unit: "years",
                    status: ageDiff > 0 ? "Optimal" : ageDiff < 0 ? "Out of range" : "In range",
                    color: ageDiff > 0 ? "#22C55E" : ageDiff < 0 ? "#EF4444" : "#FDE047"
                };
            }
        }
    }["ReportTestContent.useCallback[scoreToModal]"], [
        scores,
        chronologicalAge
    ]);
    // Handle score card click
    const handleScoreClick = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ReportTestContent.useCallback[handleScoreClick]": (scoreType)=>{
            setSelectedBiomarker(scoreToModal(scoreType));
            setIsModalOpen(true);
        }
    }["ReportTestContent.useCallback[handleScoreClick]"], [
        scoreToModal
    ]);
    // Modal handlers
    const openBiomarkerModal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ReportTestContent.useCallback[openBiomarkerModal]": (metric)=>{
            setSelectedBiomarker(metricToModal(metric));
            setIsModalOpen(true);
        }
    }["ReportTestContent.useCallback[openBiomarkerModal]"], []);
    const closeBiomarkerModal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ReportTestContent.useCallback[closeBiomarkerModal]": ()=>{
            setIsModalOpen(false);
            setTimeout({
                "ReportTestContent.useCallback[closeBiomarkerModal]": ()=>setSelectedBiomarker(null)
            }["ReportTestContent.useCallback[closeBiomarkerModal]"], 300);
        }
    }["ReportTestContent.useCallback[closeBiomarkerModal]"], []);
    // Handle category click - navigate to category route
    const handleCategoryClick = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ReportTestContent.useCallback[handleCategoryClick]": (categoryId)=>{
            setIsFilterOpen(false);
            if (categoryId === "summary" || categoryId === "all") {
                router.push("/client/report");
            } else {
                router.push(`/client/report/${categoryId}`);
            }
        }
    }["ReportTestContent.useCallback[handleCategoryClick]"], [
        router
    ]);
    // Show loading or error states
    if (isLoading) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LoadingState, {}, void 0, false, {
        fileName: "[project]/app/client/report/legacy-page.tsx",
        lineNumber: 449,
        columnNumber: 25
    }, this);
    if (error || !labReport) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ErrorState, {
        message: error || "No data"
    }, void 0, false, {
        fileName: "[project]/app/client/report/legacy-page.tsx",
        lineNumber: 450,
        columnNumber: 35
    }, this);
    const { structured_data, summary_counts } = labReport;
    const { patient, findings } = structured_data;
    // Calculate stats
    const stats = {
        total: summary_counts.total,
        optimal: summary_counts.optimal,
        inRange: summary_counts.borderline,
        outOfRange: summary_counts.flagged
    };
    // Get selected category label
    const selectedCategoryLabel = categories.find((c)=>c.id === selectedCategory)?.label || "Summary";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$sex$2d$prompt$2d$modal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SexPromptModal"], {
                isOpen: showSexPrompt,
                onClose: ()=>setShowSexPrompt(false),
                onSuccess: handleSexPromptSuccess
            }, void 0, false, {
                fileName: "[project]/app/client/report/legacy-page.tsx",
                lineNumber: 470,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col lg:flex-row gap-8 lg:gap-10",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnimatePresence"], {
                        children: isFilterOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                    className: "fixed inset-0 bg-black/40 z-40 md:hidden",
                                    initial: {
                                        opacity: 0
                                    },
                                    animate: {
                                        opacity: 1
                                    },
                                    exit: {
                                        opacity: 0
                                    },
                                    onClick: ()=>setIsFilterOpen(false)
                                }, void 0, false, {
                                    fileName: "[project]/app/client/report/legacy-page.tsx",
                                    lineNumber: 481,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                    className: "fixed top-0 left-0 h-full w-[300px] bg-white z-50 md:hidden shadow-[8px_0_30px_rgba(0,0,0,0.1)]",
                                    initial: {
                                        x: "-100%"
                                    },
                                    animate: {
                                        x: 0
                                    },
                                    exit: {
                                        x: "-100%"
                                    },
                                    transition: {
                                        type: "spring",
                                        damping: 25,
                                        stiffness: 300
                                    },
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "p-6 h-full overflow-y-auto",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center justify-between mb-8",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                        className: "text-xl font-semibold text-neutral-900",
                                                        children: "Filters"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/client/report/legacy-page.tsx",
                                                        lineNumber: 498,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: ()=>setIsFilterOpen(false),
                                                        className: "p-2 hover:bg-gray-100 rounded-full transition-colors",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                            className: "w-5 h-5 text-neutral-600"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/client/report/legacy-page.tsx",
                                                            lineNumber: 505,
                                                            columnNumber: 21
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/client/report/legacy-page.tsx",
                                                        lineNumber: 501,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/client/report/legacy-page.tsx",
                                                lineNumber: 497,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-col gap-3",
                                                children: categories.map((category, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].button, {
                                                        onClick: ()=>handleCategoryClick(category.id),
                                                        className: `flex gap-[10px] items-center w-full min-w-0 text-left transition-all duration-300 p-3 rounded-xl ${selectedCategory === category.id ? "bg-gray-50 border border-[#efefef] shadow-[0_4px_16px_rgba(0,0,0,0.06)]" : "border border-transparent hover:bg-gray-50"}`,
                                                        initial: {
                                                            x: -20,
                                                            opacity: 0
                                                        },
                                                        animate: {
                                                            x: 0,
                                                            opacity: 1
                                                        },
                                                        transition: {
                                                            duration: 0.3,
                                                            delay: index * 0.05
                                                        },
                                                        whileTap: {
                                                            scale: 0.98
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "relative size-[37px] shrink-0",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                                        className: "block size-full",
                                                                        fill: "none",
                                                                        viewBox: "0 0 37 37",
                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                                            d: __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$constants$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["svgPaths"].p20a35100,
                                                                            fill: category.color
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/client/report/legacy-page.tsx",
                                                                            lineNumber: 530,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/client/report/legacy-page.tsx",
                                                                        lineNumber: 525,
                                                                        columnNumber: 25
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "absolute inset-0 flex items-center justify-center text-[21.926px] tracking-[-0.24px]",
                                                                        style: {
                                                                            color: category.color
                                                                        },
                                                                        children: category.letter
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/client/report/legacy-page.tsx",
                                                                        lineNumber: 532,
                                                                        columnNumber: 25
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/client/report/legacy-page.tsx",
                                                                lineNumber: 524,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: `min-w-0 text-[18px] leading-snug tracking-[-0.24px] break-words ${selectedCategory === category.id ? "text-[#0a0a0a] font-medium" : "text-[#6d6d6d]"}`,
                                                                children: category.label
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/client/report/legacy-page.tsx",
                                                                lineNumber: 539,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, category.id, true, {
                                                        fileName: "[project]/app/client/report/legacy-page.tsx",
                                                        lineNumber: 511,
                                                        columnNumber: 21
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/client/report/legacy-page.tsx",
                                                lineNumber: 509,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/client/report/legacy-page.tsx",
                                        lineNumber: 496,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/client/report/legacy-page.tsx",
                                    lineNumber: 489,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true)
                    }, void 0, false, {
                        fileName: "[project]/app/client/report/legacy-page.tsx",
                        lineNumber: 478,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].aside, {
                        className: "w-full lg:w-[250px] shrink-0 lg:sticky lg:top-36 xl:top-32 self-start h-fit pt-8 xl:pt-0",
                        initial: {
                            x: -60,
                            opacity: 0
                        },
                        animate: {
                            x: 0,
                            opacity: 1
                        },
                        transition: {
                            duration: 0.55,
                            delay: 0.2
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-[14px] mb-6 lg:mb-[48px]",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "font-medium text-[28px] md:text-[36px] tracking-[-0.84px] text-[#0a0a0a]",
                                    children: "Markers"
                                }, void 0, false, {
                                    fileName: "[project]/app/client/report/legacy-page.tsx",
                                    lineNumber: 565,
                                    columnNumber: 11
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/client/report/legacy-page.tsx",
                                lineNumber: 564,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "hidden md:flex flex-row lg:flex-col gap-3 lg:gap-[24px] overflow-x-auto lg:overflow-y-auto lg:max-h-[calc(100vh-280px)] ay-scrollbar-hide pb-2 lg:pb-0",
                                children: categories.map((category, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].button, {
                                        onClick: ()=>handleCategoryClick(category.id),
                                        className: `flex gap-[10px] items-center w-auto lg:w-full min-w-0 text-left transition-all duration-300 shrink-0 px-[8px] py-[8px] rounded-[99px] ${selectedCategory === category.id ? "bg-gray-50/80 border border-[#efefef] shadow-[0_4px_16px_rgba(0,0,0,0.06)]" : "border border-transparent"}`,
                                        initial: {
                                            x: -40,
                                            opacity: 0
                                        },
                                        animate: {
                                            x: 0,
                                            opacity: 1
                                        },
                                        transition: {
                                            duration: 0.45,
                                            delay: 0.25 + index * 0.08
                                        },
                                        whileHover: {
                                            x: 6,
                                            scale: 1.03
                                        },
                                        whileTap: {
                                            scale: 0.98
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "relative size-[37px] shrink-0",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                        className: "block size-full",
                                                        fill: "none",
                                                        viewBox: "0 0 37 37",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                            d: __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$client$2f$constants$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["svgPaths"].p20a35100,
                                                            fill: category.color
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/client/report/legacy-page.tsx",
                                                            lineNumber: 589,
                                                            columnNumber: 19
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/client/report/legacy-page.tsx",
                                                        lineNumber: 588,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "absolute inset-0 flex items-center justify-center text-[21.926px] tracking-[-0.24px]",
                                                        style: {
                                                            color: category.color
                                                        },
                                                        children: category.letter
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/client/report/legacy-page.tsx",
                                                        lineNumber: 591,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/client/report/legacy-page.tsx",
                                                lineNumber: 587,
