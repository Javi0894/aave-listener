import "module-alias/register";

import { abi as AaveProtocolDataProviderAbi } from "@aave/abi/AaveProtocolDataProvider.json";
import { abi as AavePoolAbi } from "@aave/abi/Pool.json";
import { ethers, type BigNumberish } from "ethers";

interface UserReserveData {
  user: string | undefined;
  apr: number | undefined;
  suppliedByUser: number | undefined;
}

interface UserReserveDataMapping {
  selectSuppliedByUser?: (d: any | null) => number | undefined;
  selectApr?: (d: any | null) => number | undefined;
  selectUser?: (d: any | null) => string | undefined;
}

const provider = new ethers.JsonRpcProvider(
  "https://polygon-rpc.com",
  undefined,
  {
    batchMaxCount: 1,
  }
);

const aavePoolContract = new ethers.Contract(
  "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  AavePoolAbi,
  provider
);

const aaveProtocolDataProviderContract = new ethers.Contract(
  "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654",
  AaveProtocolDataProviderAbi,
  provider
);

const calculatePercentageAPY = initializeAPYFunc();

aavePoolContract.on("Supply", (reserve) => {
  aaveProtocolDataProviderContract
    .getReserveData(reserve)
    .then((data) => processUserReserveData(reserve, data))
    .catch((err) => console.log(err));
});

aavePoolContract.on("Borrow", (reserve) => {
  aaveProtocolDataProviderContract
    .getReserveData(reserve)
    .then((data) => processUserReserveData(reserve, data))
    .catch((err) => console.log(err));
});

function initializeAPYFunc(): (
  asset: string,
  apr: number | undefined
) => number | null {
  const assets: Map<string, number> = new Map();
  return (asset: string, apr: number | undefined): number | null => {
    if (apr == undefined) return null;
    const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    const apy = Math.pow(1 + apr / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1;
    const percentage = Math.round(apy * 1e4) / 1e2;
    if (percentage && assets.get(asset) != percentage) {
      assets.set(asset, percentage);
      return percentage;
    } else return null;
  };
}

function mapUserReserveData(
  data: any | null = null,
  dataMapping: UserReserveDataMapping
): UserReserveData | null {
  return data
    ? {
        user: dataMapping.selectUser?.(data),
        apr: dataMapping.selectApr?.(data),
        suppliedByUser: dataMapping.selectSuppliedByUser?.(data),
      }
    : null;
}

function convertToFloat(amount: BigNumberish, decimals: number): number {
  return parseFloat(ethers.formatUnits(amount, decimals));
}

function processUserReserveData(reserve: string, data: any | null) {
  const userReserveData: UserReserveData | null = mapUserReserveData(data, {
    selectApr: (idxApr) => convertToFloat(idxApr[5], 27),
  });
  const apy = calculatePercentageAPY(reserve, userReserveData?.apr);
  apy && console.log(reserve, apy);
}
