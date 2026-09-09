#!/usr/bin/env node
import { run } from "./program";
void run(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
