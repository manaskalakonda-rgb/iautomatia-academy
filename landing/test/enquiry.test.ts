import assert from "node:assert/strict";
import { test } from "node:test";
import { normalisePhone, validateEnquiry, validatePhone } from "../src/shared/enquiry.ts";

const valid = { name: "Ravi Kumar", phone: "95023 18939", email: "Ravi@Example.com", program: "Integrator", status: "Student" };

test("accepts a valid enquiry and normalises it", () => {
  const result = validateEnquiry(valid);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value, {
    name: "Ravi Kumar",
    phone: "+919502318939",
    email: "ravi@example.com",
    program: "Integrator",
    status: "Student",
  });
});

test("reports an error for every missing field", () => {
  const result = validateEnquiry({});
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(Object.keys(result.errors).sort(), ["email", "name", "phone", "program", "status"]);
});

test("rejects programs and statuses outside the list", () => {
  const result = validateEnquiry({ ...valid, program: "Rocket science", status: "Retired" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.program);
  assert.ok(result.errors.status);
});

test("ignores non-string values instead of crashing", () => {
  const result = validateEnquiry({ ...valid, name: 42, email: ["x"] });
  assert.equal(result.ok, false);
});

test("phone rules: Indian mobiles with optional prefixes", () => {
  for (const ok of ["9502318939", "+91 95023 18939", "919502318939", "09502318939", "95023-18939"]) {
    assert.equal(validatePhone(ok), "", ok);
    assert.equal(normalisePhone(ok), "+919502318939", ok);
  }
  for (const bad of ["12345", "5502318939", "950231893", "+1 9502318939"]) {
    assert.notEqual(validatePhone(bad), "", bad);
  }
});
