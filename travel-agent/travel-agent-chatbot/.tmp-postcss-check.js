try {
  const p = require('@tailwindcss/postcss');
  console.log('POSTCSS_OK', typeof p);
} catch (e) {
  console.log('POSTCSS_FAIL');
  console.log(e && e.stack ? e.stack : e);
  let c=e&&e.cause; let i=0;
  while(c&&i<8){ console.log('CAUSE_'+i, c.message||c); c=c.cause; i++; }
  process.exit(1);
}
