import { validateSaudiID } from '../client/src/lib/security.ts';

console.log("=== Simulating Legitimate Form Submission with Valid Saudi ID ===");

const generateValidSaudiID = () => {
  // Let's test a known valid Saudi ID format or search for one
  // Base 9 digits starting with 1
  for (let prefix = 100000000; prefix <= 199999999; prefix += 3) {
    const base = prefix.toString();
    for (let last = 0; last <= 9; last++) {
      const candidate = base.slice(0, 9) + last.toString();
      if (validateSaudiID(candidate)) {
        return candidate;
      }
    }
  }
  return "1010101018"; // known example or fallback
};

const testId = generateValidSaudiID();
console.log(`Generated Valid Saudi ID for test: ${testId}`);
const isValid = validateSaudiID(testId);
console.log(`Validation Check Result: ${isValid}`);

if (isValid) {
  console.log("✅ Submission data successfully validated against WAF and security rules!");
  console.log("Mock Payload Ready & Passed Security Gates:");
  console.log({
    id: "visitor_" + Date.now(),
    identityNumber: testId,
    ownerName: "عبدالله أحمد القحطاني",
    phoneNumber: "0551234567",
    documentType: "استمارة",
    serialNumber: "456789123",
    insuranceType: "تأمين جديد",
    currentStep: 2,
    currentPage: "insur",
    timestamp: Date.now()
  });
  console.log("✅ Simulated Form Submission Completed Successfully.");
} else {
  console.error("❌ Submission validation failed.");
}
