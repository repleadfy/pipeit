#!/usr/bin/env node
import { hasClaudeCli, printManualInstructions, printNextStep, tryInstallViaCli } from "./cli.js";

if (hasClaudeCli() && tryInstallViaCli()) {
  printNextStep();
} else {
  printManualInstructions();
  printNextStep();
}
