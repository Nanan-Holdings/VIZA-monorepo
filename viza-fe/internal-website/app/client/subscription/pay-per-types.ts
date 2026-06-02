export interface PayPerItem {
  id: string;
  productId: string;
  name: string;
  nameZh: string;
  visaName: string;
  visaNameZh: string;
  amountLabel: string;
  searchText: string;
}

export interface PayPerRegion {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  flag: string;
  href: string;
  items: PayPerItem[];
}
