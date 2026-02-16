import { readFileSync } from "node:fs";
import YAML from "yaml";
import { logProfileSchema, type LogProfile } from "../schemas/logProfiles";

function toConfigErrorMessage(path: string, message: string): string {
  return `Invalid log profile at ${path}: ${message}`;
}

export function loadLogProfile(options: {
  profilePath: string;
  expectedProfileId?: string;
}): LogProfile {
  const profileText = readFileSync(options.profilePath, "utf8");
  const rawProfile = YAML.parse(profileText) as unknown;
  const parsedProfile = logProfileSchema.parse(rawProfile);

  if (options.expectedProfileId && parsedProfile.id !== options.expectedProfileId) {
    throw new Error(
      toConfigErrorMessage(
        options.profilePath,
        `expected id '${options.expectedProfileId}' but found '${parsedProfile.id}'`,
      ),
    );
  }

  return parsedProfile;
}
