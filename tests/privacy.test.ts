import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_URL } from "./helpers.ts";
import { getOperator } from "../src/lib/privacy.ts";

// The privacy pages (/privacy, /privacy/sk) and the operator details they
// show (docs/privacy.md).

const FULL = {
  NEXT_PUBLIC_OPERATOR_NAME: "Test Operator",
  NEXT_PUBLIC_OPERATOR_ADDRESS: "Street 1\\nCity",
  NEXT_PUBLIC_CONTACT_EMAIL: "privacy@example.com",
};

test("operator details are shown only when all three variables are set", () => {
  assert.deepEqual(getOperator(FULL), { name: "Test Operator", address: "Street 1\nCity", email: "privacy@example.com" });
  assert.equal(getOperator({}), null);
  for (const missing of Object.keys(FULL)) {
    assert.equal(getOperator({ ...FULL, [missing]: "" }), null, `${missing} empty`);
    assert.equal(getOperator({ ...FULL, [missing]: undefined }), null, `${missing} missing`);
  }
});

test("a malformed e-mail address is not turned into a mailto: link", () => {
  for (const email of ["not-an-email", "a@b", 'x@y.z" onclick="alert(1)', "a b@c.d"]) {
    assert.equal(getOperator({ ...FULL, NEXT_PUBLIC_CONTACT_EMAIL: email }), null, email);
  }
});

// Needs the app running (`npm run dev`, like the voting tests). Checks both
// pages render, link to each other, and show either the configured operator
// or the neutral placeholder — whichever the running app's environment has.
test("/privacy and /privacy/sk render", async () => {
  const expected = getOperator();
  for (const [path, heading, other, placeholder] of [
    ["/privacy", "Privacy", "/privacy/sk", "Contact details will be published here before launch."],
    ["/privacy/sk", "Ochrana súkromia", "/privacy", "Kontaktné údaje prevádzkovateľa tu zverejníme pred spustením stránky."],
  ]) {
    const response = await fetch(`${APP_URL}${path}`);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, new RegExp(`<h1[^>]*>${heading}</h1>`), `${path} heading`);
    assert.ok(html.includes(`href="${other}"`), `${path} links to ${other}`);
    if (expected) {
      assert.ok(html.includes(`mailto:${expected.email}`), `${path} shows the contact e-mail`);
      assert.ok(!html.includes(placeholder), `${path} has no placeholder`);
    } else {
      assert.ok(html.includes(placeholder), `${path} shows the placeholder`);
      assert.ok(!html.includes("mailto:"), `${path} invents no e-mail`);
    }
  }
});
