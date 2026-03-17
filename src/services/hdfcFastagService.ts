import axios from "axios";
import { ApiError } from "../utils/errors";

export interface HdfcFastagRequest {
  fromDate: string;
  toDate: string;
  vehicleNumber: string;
}

export async function getHdfcFastagDetails(params: HdfcFastagRequest) {
  const { fromDate, toDate, vehicleNumber } = params;

  const url = "https://corptag.hdfc.bank.in/walletmware/api/wallet/txn/wallettxninfo";

  const body = {
    requestTime: "20210215 125830",
    fromDate,
    walletId: "W0121060317571730015",
    merchantID: "HDFCWL",
    requestID: "001",
    toDate,
    contactNumber: "",
    vehicleNumber,
    requestSource: "BD"
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization:
          "C211545150:95ef659313847c7485d43d66b8c5b9e8b817c9c136d2798333c5df693b6efc2a",
        Salt: "95ef659313847c7485d43d66b8c5b9e8b817c9c136d2798333c5df693b6efc2a",
        "Content-Type": "application/json"
      },
      timeout: 30_000
    });

    return response.data;
  } catch (error: any) {
    throw new ApiError({
      statusCode: 502,
      code: "ULIP_UNAVAILABLE",
      message:
        error?.response?.data?.resMessage ??
        error?.response?.data?.message ??
        "Failed to fetch HDFC FASTag details"
    });
  }
}

