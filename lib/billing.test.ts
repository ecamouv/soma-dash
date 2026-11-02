import { test } from "node:test";
import assert from "node:assert/strict";
import { addPeriods, buildLines, dueDateFor, feeFor, payDatesFor, periodsFrom } from "./billing.ts";

const TODAY = "2026-10-28";
const billing = (o: Partial<{ client_id: string; pay_day: number; custom_price: number | null; start_period: string }> = {}) => ({
  client_id: "a",
  pay_day: 5,
  custom_price: null,
  start_period: "2026-08",
  ...o,
});

test("addPeriods y periodsFrom cruzan el cambio de año", () => {
  assert.equal(addPeriods("2026-12", 1), "2027-01");
  assert.equal(addPeriods("2026-01", -1), "2025-12");
  assert.deepEqual(periodsFrom("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(periodsFrom("2026-10", "2026-09"), []);
});

test("dueDateFor recorta el día al último del mes", () => {
  assert.equal(dueDateFor("2026-10", 5), "2026-10-05");
  assert.equal(dueDateFor("2026-02", 31), "2026-02-28");
  assert.equal(dueDateFor("2028-02", 31), "2028-02-29"); // bisiesto
  assert.equal(dueDateFor("2026-04", 31), "2026-04-30");
});

test("feeFor prefiere el precio personalizado, luego el del paquete, luego nada", () => {
  const prices = { "1": 8000, "6_videos": 9000 };
  assert.equal(feeFor({ custom_price: 7500 }, "1", prices), 7500);
  assert.equal(feeFor({ custom_price: null }, "1", prices), 8000);
  assert.equal(feeFor(undefined, "6_videos", prices), 9000);
  assert.equal(feeFor({ custom_price: null }, "2", prices), null);
  assert.equal(feeFor({ custom_price: null }, null, prices), null);
  assert.equal(feeFor({ custom_price: 0 }, "1", prices), 0); // 0 es un precio válido, no "vacío"
});

test("buildLines: el mes actual de cada cliente y todos los meses anteriores sin pagar", () => {
  const { current, overdue } = buildLines({
    clients: [{ id: "a", package: "1" }],
    billings: [billing()],
    records: [{ client_id: "a", period: "2026-09", amount: 8000 }],
    prices: { "1": 8100 },
    todayISO: TODAY,
  });
  assert.deepEqual(current.map((l) => [l.period, l.dueDate, l.amount, l.paid]), [["2026-10", "2026-10-05", 8100, false]]);
  // agosto sin pagar, septiembre pagado
  assert.deepEqual(overdue.map((l) => l.period), ["2026-08"]);
});

test("buildLines: marcar el mes actual como pagado conserva el monto registrado aunque el precio suba", () => {
  const { current } = buildLines({
    clients: [{ id: "a", package: "1" }],
    billings: [billing({ start_period: "2026-10" })],
    records: [{ client_id: "a", period: "2026-10", amount: 8000 }],
    prices: { "1": 9500 },
    todayISO: TODAY,
  });
  assert.equal(current[0].paid, true);
  assert.equal(current[0].amount, 8000);
});

test("buildLines: pausados, sin configurar y con inicio futuro no generan renglones", () => {
  const { current, overdue } = buildLines({
    clients: [
      { id: "a", package: "1", paused: true },
      { id: "b", package: "1" }, // sin billing
      { id: "c", package: "1" }, // inicia el mes que viene
    ],
    billings: [billing({ client_id: "a" }), billing({ client_id: "c", start_period: "2026-11" })],
    records: [],
    prices: {},
    todayISO: TODAY,
  });
  assert.deepEqual(current, []);
  assert.deepEqual(overdue, []);
});

test("buildLines: el mes de inicio sí cuenta y el mes nuevo reinicia el estado", () => {
  const records = [{ client_id: "a", period: "2026-10", amount: 8000 }];
  const args = { clients: [{ id: "a", package: "1" }], billings: [billing({ start_period: "2026-10" })], records, prices: { "1": 8000 } };
  assert.equal(buildLines({ ...args, todayISO: "2026-10-30" }).current[0].paid, true);
  const nov = buildLines({ ...args, todayISO: "2026-11-01" });
  assert.equal(nov.current[0].paid, false); // noviembre arranca sin pagar
  assert.deepEqual(nov.overdue, []); // octubre estaba pagado
});

test("payDatesFor da las fechas desde el mes indicado y respeta el inicio", () => {
  assert.deepEqual(payDatesFor({ pay_day: 31, start_period: "2026-10" }, "2026-09", 3), [
    "2026-10-31",
    "2026-11-30",
    "2026-12-31",
  ]);
});
