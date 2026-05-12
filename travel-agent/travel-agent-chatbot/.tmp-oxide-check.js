try {
  console.log('RESOLVE', require.resolve('@tailwindcss/oxide-linux-x64-gnu'));
  const b = require('@tailwindcss/oxide-linux-x64-gnu');
  console.log('REQUIRE_OK', typeof b);
} catch (e) {
  console.log('REQUIRE_FAIL');
  console.log(e && e.stack ? e.stack : e);
  process.exit(1);
}
