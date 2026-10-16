import { build } from "esbuild";
await build({
  entryPoints: ["supabase/functions/gcas-api/index.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile: "supabase/functions/gcas-api/serve.ts",
  external: ["@supabase/supabase-js", "jpeg-js", "pdf-lib"],
  plugins: [
    {
      name: "deno-imports",
      setup(b) {
        b.onResolve(
          { filter: /^(@supabase\/supabase-js|jpeg-js|pdf-lib)$/ },
          (a) => ({
            path: `npm:${a.path}@${{ "@supabase/supabase-js": "2.118.0", "jpeg-js": "0.4.4", "pdf-lib": "1.17.1" }[a.path]}`,
            external: true,
          }),
        );
      },
    },
  ],
});
await build({
  stdin: {
    contents: 'export {createClient} from "@supabase/supabase-js";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  minify: true,
  supported: { "template-literal": false },
  outfile: "assets/vendor/supabase.mjs",
});
