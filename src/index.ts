import { sign, X509Certificate } from "crypto";
import fetch from "node-fetch";
import fs from "fs";
import { Console } from "console";

console.log("hello world");

const makeList = [
  [67, "Acura"],
  [70, "Alfa Romeo"],
  [72, "AMC"],
  [79, "Asuna"],
  [80, "Audi"],
  [274, "Bertone"],
  [90, "BMW"],
  [96, "Buick"],
  [97, "Cadillac"],
  [100, "Chevrolet"],
  [106, "Chrysler"],
  [111, "Daewoo"],
  [112, "Daihatsu"],
  [113, "Datsun"],
  [117, "Dodge"],
  [119, "Eagle"],
  [128, "Fiat"],
  [132, "Ford"],
  [138, "Geo"],
  [140, "GMC"],
  [145, "Honda"],
  [280, "Hummer"],
  [147, "Hyundai"],
  [149, "Infiniti"],
  [150, "International"],
  [152, "Isuzu"],
  [154, "Jaguar"],
  [155, "Jeep"],
  [161, "Kia"],
  [272, "Lancia"],
  [169, "Land Rover"],
  [170, "Lexus"],
  [171, "Lincoln"],
  [273, "Maserati"],
  [180, "Mazda"],
  [182, "Mercedes-Benz"],
  [183, "Mercury"],
  [184, "Merkur"],
  [258, "MG"],
  [185, "Mini"],
  [186, "Mitsubishi"],
  [267, "Nash"],
  [193, "Nissan"],
  [194, "Oldsmobile"],
  [196, "Opel"],
  [203, "Peugeot"],
  [205, "Plymouth"],
  [207, "Pontiac"],
  [208, "Porsche"],
  [275, "Ram"],
  [266, "Rambler"],
  [210, "Renault"],
  [214, "Saab"],
  [217, "Saturn"],
  [218, "Scion"],
  [221, "Smart"],
  [224, "Sterling"],
  [269, "Studebaker"],
  [226, "Subaru"],
  [227, "Suzuki"],
  [234, "Toyota"],
  [235, "Triumph"],
  [242, "Volkswagen"],
  [243, "Volvo"],
  [268, "Willys"],
  [253, "Yugo"],
] as const;

const favoriteLocations = [
  "PICK-n-PULL Richmond",
  "PICK-n-PULL Oakland",
  "PICK-n-PULL Newark",
  "PICK-n-PULL San Jose North",
  "PICK-n-PULL American Canyon",
] as const;

type Makes = typeof makeList[number][1];

interface SingleSearchQuery {
  make: Makes;
  model: string;
  year: number | { start: number; end: number };
  zip: number;
  distance: 10 | 25 | 50 | 100 | 250 | 500;
}

interface VehicleSearchResponseItem {
  location: {};
  vehicles: {
    id: number;
    vin: string;
    year: number;
    locationId: number;
    locationName: string;
    dateAdded: string;
  }[];
}

interface SingleVehicleResponse {
  vehicle: {
    trim: string;
    transmission: string;
    engine: string;
  };
}

interface Result {
  locationName: string;
  make: string;
  model: string;
  year: number;
  trim: string;
  transmission: string;
  engine: string;
  vin: string;
  dateAdded: Date;
  url: string;
}

const getModels = async (
  makeId: number
): Promise<{ id: number; name: string; makeId: number }[]> => {
  const response = await fetch(
    `https://www.picknpull.com/api/vehicle/makes/${makeId}/models`,
    {
      method: "GET",
    }
  );
  return await response.json();
};

const getVehicleDetails = async (
  vin: string
): Promise<SingleVehicleResponse> => {
  const response = await fetch(`https://www.picknpull.com/api/vehicle/${vin}`, {
    method: "GET",
  });
  return await response.json();
};

const basicSearch = async (query: SingleSearchQuery) => {
  const makeId = makeList.find((x) => x[1] === query.make)?.[0];
  if (makeId === undefined) throw Error(`unknown make ${query.make}`);
  const models = await getModels(makeId);
  const modelId = models.find((x) => x.name === query.model)?.id;
  if (modelId === undefined)
    throw Error(
      `unknown model ${query.model}, expected: ${models
        .map((x) => x.name)
        .join(", ")}`
    );
  const response = await fetch(
    `https://www.picknpull.com/api/vehicle/search?&makeId=${makeId}&modelId=${modelId}&year=${
      typeof query.year === "number"
        ? query.year
        : `${query.year.start}-${query.year.end}`
    }&distance=${query.distance}&zip=${query.zip}`,
    {
      body: undefined,
      method: "GET",
    }
  );

  return (await response.json()) as VehicleSearchResponseItem[];
};

const searchWithTrim = async (query: SingleSearchQuery): Promise<Result[]> => {
  const basicResults = await basicSearch(query);
  const detailResults = await Promise.all(
    basicResults
      .map((x) => x.vehicles)
      .flat()
      .map((x) =>
        getVehicleDetails(x.vin).then((singleResponse) => ({
          ...x,
          trim: singleResponse.vehicle.trim,
          transmission: singleResponse.vehicle.transmission,
          engine: singleResponse.vehicle.engine,
        }))
      )
  );
  return detailResults.map((x) => ({
    locationName: x.locationName,
    make: query.make,
    model: query.model,
    year: x.year,
    trim: x.trim,
    transmission: x.transmission,
    engine: x.engine,
    vin: x.vin,
    dateAdded: new Date(x.dateAdded),
    url: `https://www.picknpull.com/check-inventory/vehicle-details/${x.vin}`,
  }));
};

async function main() {
  const civics = (
    await searchWithTrim({
      make: "Honda",
      model: "Civic",
      year: { start: 1994, end: 1995 },
      distance: 50,
      zip: 94132,
    })
  ).filter((x) => x.trim.includes("EX") && x.transmission.includes("Manual"));

  console.log("Civics: ", civics);

  const delSols = (
    await searchWithTrim({
      make: "Honda",
      model: "Civic Del Sol",
      year: { start: 1994, end: 1995 },
      distance: 50,
      zip: 94132,
    })
  ).filter((x) => x.trim.includes("Si") && x.transmission.includes("Manual"));

  console.log("Del Sols: ", delSols);

  const allUrls = [...civics.map((x) => x.url), ...delSols.map((x) => x.url)];
  console.log(
    "all matches:\n",
    JSON.stringify([...civics.map((x) => x.url), ...delSols.map((x) => x.url)])
  );

  const knownUrls = JSON.parse(
    fs.readFileSync("knownUrls.json", { encoding: "utf8" })
  ) as string[];

  allUrls.forEach((url) => {
    if (!knownUrls.includes(url)) {
      console.log(`NEW MATCH: ${url}`);
    }
  });

  console.log(`completed ${new Date().toLocaleString()}`);
}

main();
