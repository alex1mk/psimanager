
// Simulate the logic in PatientService.create
enum PaymentType {
    SESSION = 'Sessão',
    BIWEEKLY = 'Quinzenal',
    MONTHLY = 'Mensal'
}

interface Patient {
    paymentType: PaymentType;
}

function getDbPaymentType(paymentType: PaymentType): string {
    let dbPaymentType = 'Por Sessão';
    if (paymentType === PaymentType.MONTHLY) dbPaymentType = 'Mensal';
    if (paymentType === PaymentType.BIWEEKLY) dbPaymentType = 'Quinzenal';
    return dbPaymentType;
}

// Test Cases
const testCases = [
    { input: PaymentType.SESSION, expected: 'Por Sessão' },
    { input: PaymentType.MONTHLY, expected: 'Mensal' },
    { input: PaymentType.BIWEEKLY, expected: 'Quinzenal' }
];

console.log("=== Verification of Payment Logic ===");
let allPassed = true;

testCases.forEach(test => {
    const result = getDbPaymentType(test.input);
    const passed = result === test.expected;
    console.log(`Input: "${test.input}" -> Output: "${result}" | Expected: "${test.expected}" | ${passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!passed) allPassed = false;
});

if (allPassed) {
    console.log("\n>>> SUCCESS: All payment type normalizations are correct.");
} else {
    console.error("\n>>> FAILURE: Some normalizations failed.");
    process.exit(1);
}
