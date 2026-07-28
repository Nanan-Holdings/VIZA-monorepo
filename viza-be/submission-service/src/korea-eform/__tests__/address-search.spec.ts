import assert from "node:assert/strict";
import test from "node:test";

import { parseKoreaAddressSearchResponse } from "../address-search";

test("parses Korea Visa Portal juso JSONP address response", () => {
  const result = parseKoreaAddressSearchResponse(
    "({'returnXml':'<?xml version=\"1.0\" encoding=\"UTF-8\"?><results><common><totalCount>1</totalCount><currentPage>1</currentPage><countPerPage>5</countPerPage><errorCode>0</errorCode><errorMessage>정상</errorMessage></common><juso><roadAddr>서울특별시 강남구 가로수길 5 (신사동)</roadAddr><roadAddrPart1>서울특별시 강남구 가로수길 5</roadAddrPart1><roadAddrPart2> (신사동)</roadAddrPart2><jibunAddr>서울특별시 강남구 신사동 537-5</jibunAddr><engAddr>5 Garosu-gil, Gangnam-gu, Seoul</engAddr><zipNo>06035</zipNo><admCd>1168010700</admCd><rnMgtSn>116804858362</rnMgtSn><bdMgtSn>1168010700105370005011918</bdMgtSn><bdNm></bdNm><siNm>서울특별시</siNm><sggNm>강남구</sggNm><emdNm>신사동</emdNm><rn>가로수길</rn><udrtYn>0</udrtYn><buldMnnm>5</buldMnnm><buldSlno>0</buldSlno><mtYn>0</mtYn><lnbrMnnm>537</lnbrMnnm><lnbrSlno>5</lnbrSlno></juso></results>'})",
    { language: "ko", keyword: "서울특별시 강남구", page: 1, countPerPage: 5 },
  );

  assert.equal(result.source, "juso.go.kr");
  assert.equal(result.totalCount, 1);
  assert.equal(result.errorCode, "0");
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0]?.zipNo, "06035");
  assert.equal(result.records[0]?.englishAddress, "5 Garosu-gil, Gangnam-gu, Seoul");
});
