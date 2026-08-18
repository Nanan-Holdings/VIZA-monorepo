import assert from "node:assert/strict";
import test from "node:test";

import {
  PH_ETRAVEL_CURRENT_ARRIVAL_PURPOSE_OPTIONS,
  isPhEtravelCurrentArrivalPurposeCode,
  resolvePhEtravelAirFlightOption,
  resolvePhEtravelAirlineOption,
  resolvePhEtravelSeaDestinationPortOption,
} from "../official-options";

test("E49 admits the current 16 official arrival purpose codes by code only", () => {
  assert.equal(PH_ETRAVEL_CURRENT_ARRIVAL_PURPOSE_OPTIONS.length, 16);
  assert.equal(isPhEtravelCurrentArrivalPurposeCode("POV001"), true);
  assert.equal(isPhEtravelCurrentArrivalPurposeCode("OFW"), true);
  assert.equal(isPhEtravelCurrentArrivalPurposeCode("POV999"), true);
  assert.equal(isPhEtravelCurrentArrivalPurposeCode("Holiday/Pleasure/Vacation"), false);
  assert.equal(isPhEtravelCurrentArrivalPurposeCode("Others"), false);
});

test("E46 AIR options recover by code and enforce the selected airline parent", () => {
  const airlines = [{ code: "AIR001", name: "Example Airline" }];
  const flights = [
    { code: "FLIGHT001", name: "Example Flight", travel_company_code: "AIR001", travel_port_code: "PORT001" },
    { code: "FLIGHT001", name: "Example Flight", travel_company_code: "AIR002", travel_port_code: "PORT002" },
  ];

  assert.deepEqual(resolvePhEtravelAirlineOption({ code: "AIR001", options: airlines }), airlines[0]);
  assert.equal(resolvePhEtravelAirlineOption({ code: "Example Airline", options: airlines }), null);
  assert.deepEqual(
    resolvePhEtravelAirFlightOption({ airlineCode: "AIR001", flightCode: "FLIGHT001", options: flights }),
    flights[0],
  );
  assert.equal(
    resolvePhEtravelAirFlightOption({ airlineCode: "AIR002", flightCode: "FLIGHT001", options: [flights[0]] }),
    null,
  );
});

test("E46 SEA destination recovery never chooses a duplicate label", () => {
  const ports = [
    { code: "TP120", name: "Port of Legazpi" },
    { code: "LEGAZPI", name: "Port of Legazpi" },
  ];

  assert.deepEqual(resolvePhEtravelSeaDestinationPortOption({ code: "TP120", options: ports }), ports[0]);
  assert.deepEqual(resolvePhEtravelSeaDestinationPortOption({ code: "LEGAZPI", options: ports }), ports[1]);
  assert.equal(resolvePhEtravelSeaDestinationPortOption({ code: "Port of Legazpi", options: ports }), null);
});
