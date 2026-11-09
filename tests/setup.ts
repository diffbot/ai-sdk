/*
  Any unit test that forgets to inject a fake fetch must fail loudly instead of
  silently hitting the network.
*/
globalThis.fetch = (() => {
  throw new Error("Unexpected network call: inject fetch via DiffbotAuth.fetch or client");
}) as typeof fetch;
