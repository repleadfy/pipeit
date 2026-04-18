#!/usr/bin/env node
import { hasClaudeCli, tryInstallViaCli, printManualInstructions, printNextStep } from "./cli.js";

if (hasClaudeCli() && tryInstallViaCli()) {
  printNextStep();
} else {
  printManualInstructions();
  printNextStep();
}
