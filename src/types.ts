export interface MenuItem {
  id: string;
  name: string;
  hasOptions: boolean;
  supportsShotOptions: boolean;
  category: 'coffee' | 'tea' | 'juice' | 'etc';
}

export interface CartItem {
  id: string; // Unique ID for the cart entry
  menuId: string;
  name: string;
  option?: 'HOT' | 'ICE';
  shotOption?: '샷추가' | '연하게' | '기본';
  quantity: number;
}

export interface Order {
  id: string;
  nickname: string;
  items: CartItem[];
  comment?: string;
  arrivalTime: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'cancelled';
}

export const MENU_ITEMS: MenuItem[] = [
  { id: '1', name: '아메리카노', hasOptions: true, supportsShotOptions: true, category: 'coffee' },
  { id: '2', name: '카페라떼', hasOptions: true, supportsShotOptions: true, category: 'coffee' },
  { id: '3', name: '바닐라라떼', hasOptions: true, supportsShotOptions: true, category: 'coffee' },
  { id: '4', name: '카라멜 마끼야또', hasOptions: true, supportsShotOptions: true, category: 'coffee' },
  { id: '5', name: '토피넛라떼', hasOptions: true, supportsShotOptions: true, category: 'coffee' },
  { id: '6', name: '복숭아아이스티', hasOptions: false, supportsShotOptions: true, category: 'tea' },
  { id: '7', name: '페퍼민트', hasOptions: true, supportsShotOptions: false, category: 'tea' },
  { id: '8', name: '캐모마일', hasOptions: true, supportsShotOptions: false, category: 'tea' },
  { id: '9', name: '오렌지주스', hasOptions: false, supportsShotOptions: false, category: 'juice' },
  { id: '10', name: '쌍화차', hasOptions: false, supportsShotOptions: false, category: 'etc' },
];
