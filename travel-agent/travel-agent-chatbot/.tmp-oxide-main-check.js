try {
  const b = require('@tailwindcss/oxide');
  console.log('MAIN_REQUIRE_OK', typeof b, Object.keys(b).slice(0,5));
} catch (e) {
  console.log('MAIN_REQUIRE_FAIL');
  console.log(e && e.stack ? e.stack : e);
  if (e && e.cause) {
    let c = e.cause;
    let i = 0;
    while (c && i < 8) {
      console.log('CAUSE_'+i, c.message || c);
      c = c.cause;
      i++;
    }
  }
  process.exit(1);
}
