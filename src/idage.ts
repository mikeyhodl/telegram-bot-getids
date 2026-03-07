import ages from "./ages.json";

interface AgeResult {
  status: -1 | 0 | 1;
  date: Date;
}

type AgeOutput = [string, string];

const ids = Object.keys(ages) as Array<keyof typeof ages>;
const nids = ids.map((e) => Number.parseInt(String(e), 10));

const firstIdKey = ids[0];
const lastIdKey = ids.at(-1) ?? firstIdKey;

const minId = nids[0];
const maxId = nids.at(-1) ?? minId;

const getDate = (id: number): AgeResult => {
  if (id < minId) {
    return { status: -1, date: new Date(ages[firstIdKey]) };
  }

  if (id > maxId) {
    return {
      status: 1,
      date: new Date(ages[lastIdKey]),
    };
  }

  for (let i = 0; i < ids.length; i++) {
    if (id <= nids[i]) {
      // The first known ID has no lower bound for interpolation.
      if (i === 0) {
        return { status: 0, date: new Date(ages[firstIdKey]) };
      }

      const lowerId = nids[i - 1];
      const upperId = nids[i];
      const lowerAge = ages[ids[i - 1]];
      const upperAge = ages[ids[i]];

      const idRatio = (id - lowerId) / (upperId - lowerId);
      const midDate = Math.floor(idRatio * (upperAge - lowerAge) + lowerAge);
      return { status: 0, date: new Date(midDate) };
    }
  }

  // Fallback to newest.
  return { status: 1, date: new Date(ages[lastIdKey]) };
};

const getAge = (id: number): AgeOutput => {
  const d = getDate(id);
  let ageKey: string;

  if (d.status < 0) {
    ageKey = "older_than";
  } else if (d.status > 0) {
    ageKey = "newer_than";
  } else {
    ageKey = "aprox";
  }

  return [ageKey, `${d.date.getUTCMonth() + 1}/${d.date.getUTCFullYear()}`];
};

export default getAge;
