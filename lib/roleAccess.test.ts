import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccess, canManageBilling } from "./roleAccess.ts";

test("operaciones no ve Inspiración ni Accesos Web, pero sí lo demás", () => {
  assert.equal(canAccess("operaciones", "/inspiracion"), false);
  assert.equal(canAccess("operaciones", "/accesos"), false);
  assert.equal(canAccess("operaciones", "/clientes"), true);
  assert.equal(canAccess("operaciones", "/"), true);
});

test("community no ve Inspiración ni Entregas, pero sí Accesos Web y Publicaciones", () => {
  assert.equal(canAccess("community", "/inspiracion"), false);
  assert.equal(canAccess("community", "/entregas"), false);
  assert.equal(canAccess("community", "/publicaciones"), true);
  assert.equal(canAccess("community", "/accesos"), true);
});

test("prod, admin, dev, editor y sin rol ven todo", () => {
  for (const role of ["prod", "admin", "dev", "editor", undefined] as const) {
    assert.equal(canAccess(role, "/inspiracion"), true);
    assert.equal(canAccess(role, "/accesos"), true);
    assert.equal(canAccess(role, "/entregas"), true);
  }
});

test("Paquetes solo lo ven admin, dev y operaciones", () => {
  for (const role of ["admin", "dev", "operaciones"] as const) assert.equal(canAccess(role, "/paquetes"), true);
  for (const role of ["prod", "editor", "community"] as const) assert.equal(canAccess(role, "/paquetes"), false);
});

test("canManageBilling coincide con la política de la base", () => {
  assert.equal(canManageBilling("admin"), true);
  assert.equal(canManageBilling("dev"), true);
  assert.equal(canManageBilling("operaciones"), true);
  assert.equal(canManageBilling("prod"), false);
  assert.equal(canManageBilling("community"), false);
  assert.equal(canManageBilling("editor"), false);
  assert.equal(canManageBilling(undefined), false);
});
