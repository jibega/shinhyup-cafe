import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coffee, 
  User, 
  Clock, 
  MessageSquare, 
  CheckCircle2, 
  ChevronRight, 
  LayoutDashboard, 
  Plus,
  Minus,
  Trash2,
  Send,
  ShoppingCart,
  X,
  AlertCircle,
  LogIn
} from 'lucide-react';
import { MENU_ITEMS, MenuItem, Order, CartItem } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  where
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.error.includes("Missing or insufficient permissions")) {
            errorMessage = "권한이 없습니다. 관리자에게 문의하거나 다시 로그인해주세요.";
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="glass-card p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">오류가 발생했습니다</h2>
            <p className="text-slate-500">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-shinhyup-blue text-white py-4 rounded-2xl font-bold"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const [view, setView] = useState<'order' | 'admin'>('order');
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
  const [selectedTemp, setSelectedTemp] = useState<'HOT' | 'ICE' | undefined>();
  const [selectedShot, setSelectedShot] = useState<'샷추가' | '연하게' | '기본'>('기본');
  const [comment, setComment] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoUrl, setLogoUrl] = useState("https://storage.googleapis.com/static.aistudio.google.com/content/file_2.png");
  const [logoError, setLogoError] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  
  // Real-time orders listener
  useEffect(() => {
    // Filter orders: only keep orders from the current "day cycle" (starting at 1 AM)
    const now = new Date();
    const last1AM = new Date(now);
    last1AM.setHours(1, 0, 0, 0);
    if (now.getHours() < 1) {
      last1AM.setDate(last1AM.getDate() - 1);
    }

    const q = query(
      collection(db, 'orders'),
      where('timestamp', '>=', last1AM.getTime()),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Order[];
      setOrders(fetchedOrders);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, []);

  // Set default arrival time
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    setArrivalTime(`${hours}:${mins}`);
  }, []);

  // Timer to force re-render for the cancellation window
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;

  const addToCart = (menu: MenuItem, temp?: 'HOT' | 'ICE', shot: '샷추가' | '연하게' | '기본' = '기본') => {
    const existingItemIndex = cart.findIndex(
      item => item.menuId === menu.id && item.option === temp && item.shotOption === shot
    );

    if (existingItemIndex > -1) {
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += 1;
      setCart(newCart);
    } else {
      const newItem: CartItem = {
        id: Math.random().toString(36).substr(2, 9),
        menuId: menu.id,
        name: menu.name,
        option: temp,
        shotOption: menu.supportsShotOptions ? shot : undefined,
        quantity: 1
      };
      setCart([...cart, newItem]);
    }
    setShowOptionModal(false);
    setSelectedMenu(null);
    setSelectedTemp(undefined);
    setSelectedShot('기본');
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleMenuSelect = (menu: MenuItem) => {
    setSelectedMenu(menu);
    if (menu.hasOptions || menu.supportsShotOptions) {
      setShowOptionModal(true);
    } else {
      addToCart(menu);
    }
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    // Sanitize cart items to remove undefined values which Firestore doesn't support
    const sanitizedItems = cart.map(item => {
      const sanitized: any = {
        id: item.id,
        menuId: item.menuId,
        name: item.name,
        quantity: item.quantity
      };
      if (item.option) sanitized.option = item.option;
      if (item.shotOption) sanitized.shotOption = item.shotOption;
      return sanitized;
    });

    const orderData = {
      nickname: nickname || '익명',
      items: sanitizedItems,
      comment: comment || '',
      arrivalTime: arrivalTime || '미지정',
      timestamp: Date.now(),
      status: 'pending',
      uid: auth.currentUser?.uid || 'anonymous'
    };

    try {
      // 1. Save to Firestore
      await addDoc(collection(db, 'orders'), orderData);

      // 2. Send to Formspree
      const formData = new FormData();
      formData.append('nickname', orderData.nickname);
      formData.append('arrivalTime', orderData.arrivalTime);
      formData.append('comment', orderData.comment || '없음');
      formData.append('orderItems', orderData.items.map(item => 
        `${item.name}${item.option ? `(${item.option})` : ''}${item.shotOption && item.shotOption !== '기본' ? `[${item.shotOption}]` : ''} x${item.quantity}`
      ).join('\n'));
      formData.append('timestamp', new Date(orderData.timestamp).toLocaleString());
      formData.append('_subject', `[신협주문] ${orderData.nickname}님의 주문이 접수되었습니다.`);

      await fetch('https://formspree.io/f/xnjgoevd', {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      });

      setStep(4);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: 'pending' | 'completed' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const resetForm = () => {
    setStep(1);
    setNickname('');
    setCart([]);
    setComment('');
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    setArrivalTime(`${hours}:${mins}`);
  };

  const addMinutesToNow = (minutes: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    setArrivalTime(`${hours}:${mins}`);
  };

  const adjustTime = (minutes: number) => {
    const [hours, mins] = arrivalTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(mins + minutes);
    const newHours = String(date.getHours()).padStart(2, '0');
    const newMins = String(date.getMinutes()).padStart(2, '0');
    setArrivalTime(`${newHours}:${newMins}`);
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-shinhyup-blue text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-shinhyup-yellow p-2 rounded-xl flex items-center justify-center w-11 h-11 shadow-sm">
            <Coffee className="text-shinhyup-blue w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">신협직원주문</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setView(view === 'order' ? 'admin' : 'order')}
            className="flex items-center gap-2 bg-[#1E5BA3] hover:bg-[#154a85] px-5 py-2 rounded-full transition-all text-sm font-bold shadow-sm relative"
          >
            {view === 'order' ? (
              <>
                <LayoutDashboard size={18} /> 
                관리자
                {/* Side-by-side badges on the top right of the button: Blue(Left), Red(Right) */}
                <div className="absolute -top-2 -right-2 flex gap-0.5">
                  <AnimatePresence>
                    {completedCount > 0 && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        key="completed-badge"
                        className="bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm border border-white/20"
                      >
                        {completedCount}
                      </motion.span>
                    )}
                    {pendingCount > 0 && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        key="pending-badge"
                        className="bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm border border-white/20"
                      >
                        {pendingCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <><Coffee size={18} /> 주문하기</>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 pb-32">
        {view === 'order' ? (
          <div className="space-y-8">
            {/* Progress Bar */}
            <div className="flex justify-between items-center px-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-500",
                    step === i ? "bg-shinhyup-blue text-white" : 
                    step > i ? "bg-shinhyup-blue text-white" : "bg-slate-200 text-slate-400"
                  )}>
                    {i}
                  </div>
                  {i < 4 && (
                    <div className={cn(
                      "h-1 flex-1 mx-2 rounded-full",
                      "bg-slate-200"
                    )} />
                  )}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white p-8 rounded-3xl space-y-8 shadow-xl border border-slate-100"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-slate-800">반갑습니다!</h2>
                    <p className="text-slate-500">주문을 위해 닉네임을 입력해주세요.</p>
                  </div>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="text"
                      placeholder="닉네임 (예: 홍길동 대리)"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && nickname.trim()) {
                          setStep(2);
                        }
                      }}
                      className="w-full pl-12 pr-4 py-4 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-shinhyup-blue outline-none text-lg"
                    />
                  </div>
                  <button 
                    disabled={!nickname.trim()}
                    onClick={() => setStep(2)}
                    className="w-full bg-[#85A9D0] text-white py-4 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-80 transition-all flex items-center justify-center gap-2"
                  >
                    다음 단계로 <ChevronRight size={20} />
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-slate-800">메뉴를 선택하세요</h2>
                    <p className="text-slate-500">원하시는 음료를 골라주세요. (여러 개 선택 가능)</p>
                  </div>
                  
                  {/* Cart Summary in Step 2 */}
                  <div className="sticky top-[76px] z-30 -mx-6 px-6 py-2 bg-slate-50/90 backdrop-blur-md transition-all">
                    {cart.length > 0 ? (
                      <div className="glass-card p-3 md:p-4 rounded-2xl space-y-2 md:space-y-3 border-shinhyup-blue/20 bg-shinhyup-blue/5 shadow-lg">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs md:text-sm font-bold text-shinhyup-blue flex items-center gap-2">
                            <ShoppingCart size={14} className="md:w-4 md:h-4" /> 선택한 메뉴 ({totalItems})
                          </h4>
                        </div>
                        <div className="max-h-[120px] md:max-h-[160px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                          {cart.map((item) => (
                            <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm">{item.name}</span>
                                <div className="flex gap-1">
                                  {item.option && (
                                    <span className={cn(
                                      "text-[10px] font-bold px-1.5 py-0.5 rounded w-fit",
                                      item.option === 'HOT' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                                    )}>
                                      {item.option}
                                    </span>
                                  )}
                                  {item.shotOption && item.shotOption !== '기본' && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded w-fit bg-slate-100 text-slate-600">
                                      {item.shotOption}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center bg-slate-100 rounded-lg px-2 py-1 gap-3">
                                  <button onClick={() => updateQuantity(item.id, -1)} className="text-slate-500 hover:text-shinhyup-blue"><Minus size={14} /></button>
                                  <span className="text-sm font-bold min-w-[1rem] text-center">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(item.id, 1)} className="text-slate-500 hover:text-shinhyup-blue"><Plus size={14} /></button>
                                </div>
                                <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500"><X size={18} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button 
                          onClick={() => setStep(3)}
                          className="w-full bg-shinhyup-blue text-white py-3 rounded-xl font-bold text-sm shadow-md active:scale-[0.98] transition-transform"
                        >
                          선택 완료 및 다음 단계로
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-xs text-slate-400 font-medium italic">메뉴를 선택하면 여기에 표시됩니다</p>
                      </div>
                    )}
                  </div>

                  {/* Floating Bottom Cart for Mobile */}
                  <AnimatePresence>
                    {cart.length > 0 && (
                      <motion.div 
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-6 left-6 right-6 z-40 md:hidden"
                      >
                        <div className="bg-shinhyup-blue text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between gap-4">
                          <button 
                            onClick={() => setShowCartDrawer(!showCartDrawer)}
                            className="flex items-center gap-3 flex-1"
                          >
                            <div className="bg-white/20 p-2 rounded-xl relative">
                              <ShoppingCart size={20} />
                              <span className="absolute -top-2 -right-2 bg-shinhyup-yellow text-shinhyup-blue text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-shinhyup-blue">
                                {totalItems}
                              </span>
                            </div>
                            <div className="text-left">
                              <p className="text-[10px] font-medium opacity-80">선택한 메뉴</p>
                              <p className="text-sm font-bold truncate max-w-[120px]">
                                {cart[cart.length - 1].name} {cart.length > 1 ? `외 ${cart.length - 1}건` : ''}
                              </p>
                            </div>
                          </button>
                          <button 
                            onClick={() => setStep(3)}
                            className="bg-shinhyup-yellow text-shinhyup-blue px-6 py-3 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.95] transition-transform"
                          >
                            주문하기
                          </button>
                        </div>
                        
                        {/* Mobile Cart Drawer */}
                        <AnimatePresence>
                          {showCartDrawer && (
                            <>
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowCartDrawer(false)}
                                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm -z-10"
                              />
                              <motion.div 
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                className="absolute bottom-20 left-0 right-0 bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[60vh] overflow-y-auto -z-10"
                              >
                                <div className="flex items-center justify-between border-b pb-4">
                                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                    <ShoppingCart size={18} className="text-shinhyup-blue" /> 선택한 메뉴 상세
                                  </h4>
                                  <button onClick={() => setShowCartDrawer(false)} className="text-slate-400"><X size={20} /></button>
                                </div>
                                <div className="space-y-3">
                                  {cart.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-sm">{item.name}</span>
                                        <div className="flex gap-1">
                                          {item.option && (
                                            <span className={cn(
                                              "text-[10px] font-bold px-1.5 py-0.5 rounded w-fit",
                                              item.option === 'HOT' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                                            )}>
                                              {item.option}
                                            </span>
                                          )}
                                          {item.shotOption && item.shotOption !== '기본' && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded w-fit bg-slate-100 text-slate-600">
                                              {item.shotOption}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div className="flex items-center bg-white rounded-xl px-2 py-1 gap-4 shadow-sm">
                                          <button onClick={() => updateQuantity(item.id, -1)} className="text-slate-400"><Minus size={16} /></button>
                                          <span className="text-sm font-bold min-w-[1rem] text-center">{item.quantity}</span>
                                          <button onClick={() => updateQuantity(item.id, 1)} className="text-slate-400"><Plus size={16} /></button>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-red-400"><Trash2 size={18} /></button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-2 gap-4">
                    {MENU_ITEMS.map((item) => {
                      const quantityInCart = cart
                        .filter(c => c.menuId === item.id)
                        .reduce((sum, c) => sum + c.quantity, 0);
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleMenuSelect(item)}
                          className={cn(
                            "glass-card p-6 rounded-3xl text-left transition-all group relative overflow-hidden active:scale-[0.97] border-2",
                            quantityInCart > 0 
                              ? "border-shinhyup-blue bg-shinhyup-blue/5 shadow-md" 
                              : "border-transparent hover:border-shinhyup-blue/30"
                          )}
                        >
                          {quantityInCart > 0 && (
                            <div className="absolute top-3 right-3 bg-shinhyup-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm z-10 animate-in zoom-in duration-300">
                              {quantityInCart}
                            </div>
                          )}
                          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Coffee size={80} />
                          </div>
                          <span className="text-xs font-bold text-shinhyup-blue bg-shinhyup-blue/10 px-2 py-1 rounded-md mb-2 inline-block uppercase">
                            {item.category}
                          </span>
                          <h3 className="text-lg font-bold text-slate-800">{item.name}</h3>
                          <div className="mt-2 text-shinhyup-blue opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-bold">
                            <Plus size={14} /> 담기
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button 
                    onClick={() => setStep(1)}
                    className="w-full py-4 text-slate-400 font-medium"
                  >
                    이전으로 돌아가기
                  </button>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass-card p-8 rounded-3xl space-y-8"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <ShoppingCart size={20} className="text-shinhyup-blue" /> 주문 내역 확인
                    </h3>
                    <div className="space-y-2">
                      {cart.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                          <div className="flex flex-col">
                            <span className="font-bold">{item.name}</span>
                            <div className="flex gap-1">
                              {item.option && (
                                <span className={cn(
                                  "text-xs font-bold",
                                  item.option === 'HOT' ? "text-red-500" : "text-blue-500"
                                )}>
                                  {item.option}
                                </span>
                              )}
                              {item.shotOption && item.shotOption !== '기본' && (
                                <span className="text-xs font-bold text-slate-500">
                                  {item.shotOption}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-shinhyup-blue">x {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                          <Clock size={16} className="text-shinhyup-blue" /> 도착 예정 시간
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">
                          현재 시각: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {[0, 5, 10, 15, 20, 30].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => addMinutesToNow(mins)}
                            className={cn(
                              "whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all shadow-sm",
                              "bg-white border-slate-100 text-slate-500 hover:border-shinhyup-blue hover:text-shinhyup-blue"
                            )}
                          >
                            {mins === 0 ? '지금' : `${mins}분 뒤`}
                          </button>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl">
                        <button 
                          onClick={() => adjustTime(-1)}
                          className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-shinhyup-blue hover:bg-shinhyup-blue hover:text-white transition-all"
                        >
                          <Minus size={20} />
                        </button>
                        <div className="flex-1 flex flex-col items-center justify-center py-2">
                          <input 
                            type="time"
                            value={arrivalTime}
                            onChange={(e) => setArrivalTime(e.target.value)}
                            className="w-full bg-transparent border-none text-center text-2xl font-bold text-slate-800 outline-none p-0 h-auto leading-none cursor-pointer"
                            style={{ colorScheme: 'light' }}
                          />
                        </div>
                        <button 
                          onClick={() => adjustTime(1)}
                          className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-shinhyup-blue hover:bg-shinhyup-blue hover:text-white transition-all"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                        <MessageSquare size={16} /> 추가 코멘트 (선택)
                      </label>
                      <textarea 
                        placeholder="예: 빨간색 텀블러입니다 등"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full p-4 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-shinhyup-blue outline-none h-32 resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setStep(2)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold"
                    >
                      이전
                    </button>
                    <button 
                      disabled={!arrivalTime || cart.length === 0 || isSubmitting}
                      onClick={handleSubmitOrder}
                      className="flex-[2] bg-shinhyup-blue text-white py-4 rounded-2xl font-bold shadow-lg shadow-shinhyup-blue/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send size={20} />
                      )}
                      {isSubmitting ? '전송 중...' : '주문하기'}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card p-12 rounded-3xl text-center space-y-6"
                >
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={48} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-slate-800">주문 완료!</h2>
                    <p className="text-slate-500">맛있게 준비해 드릴게요.</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl text-left space-y-3 max-h-48 overflow-y-auto">
                    <div className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                      <span className="text-slate-400">닉네임</span>
                      <span className="font-bold">{nickname}</span>
                    </div>
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <div className="flex flex-col">
                          <span className="text-slate-600">{item.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {item.option} {item.shotOption && item.shotOption !== '기본' ? `| ${item.shotOption}` : ''}
                          </span>
                        </div>
                        <span className="font-bold">x {item.quantity}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-slate-200 mt-2">
                      <span className="text-slate-400">도착예정</span>
                      <span className="font-bold">{arrivalTime}</span>
                    </div>
                  </div>
                  <button 
                    onClick={resetForm}
                    className="w-full bg-shinhyup-blue text-white py-4 rounded-2xl font-bold"
                  >
                    처음으로 돌아가기
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* Admin Dashboard */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">주문 현황</h2>
              <span className="bg-shinhyup-blue text-white px-3 py-1 rounded-full text-xs font-bold">
                총 {orders.length}건
              </span>
            </div>

            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="glass-card p-12 rounded-3xl text-center text-slate-400">
                  <Coffee size={48} className="mx-auto mb-4 opacity-20" />
                  <p>접수된 주문이 없습니다.</p>
                </div>
              ) : (
                orders.map((order) => (
                  <motion.div 
                    layout
                    key={order.id}
                    className={cn(
                      "glass-card p-6 rounded-3xl flex justify-between items-start gap-4 transition-opacity",
                      order.status === 'cancelled' && "opacity-50 grayscale"
                    )}
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-bold text-lg",
                          order.status === 'cancelled' && "line-through text-slate-400"
                        )}>
                          {order.nickname}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(order.timestamp).toLocaleTimeString()}
                        </span>
                        {order.status === 'cancelled' && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">취소됨</span>
                        )}
                      </div>
                      
                      <div className="space-y-1.5">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <h3 className={cn(
                              "text-base font-bold text-shinhyup-blue",
                              order.status === 'cancelled' && "line-through text-slate-400"
                            )}>
                              {item.name}
                            </h3>
                            <div className="flex gap-1">
                              {item.option && (
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                  order.status === 'cancelled' 
                                    ? "bg-slate-100 text-slate-400" 
                                    : (item.option === 'HOT' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600')
                                )}>
                                  {item.option}
                                </span>
                              )}
                              {item.shotOption && item.shotOption !== '기본' && (
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600",
                                  order.status === 'cancelled' && "text-slate-400"
                                )}>
                                  {item.shotOption}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-bold text-slate-400">x {item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {order.comment && (
                        <p className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                          "{order.comment}"
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock size={12} /> 도착 예정: {order.arrivalTime}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {order.status === 'pending' && (Date.now() - order.timestamp < 10000) && (
                        <button 
                          onClick={() => updateOrderStatus(order.id, 'cancelled')}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          title="10초 이내 취소 가능"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                      <button 
                        disabled={order.status === 'cancelled'}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                          order.status === 'pending' ? "bg-shinhyup-yellow text-shinhyup-blue" : 
                          order.status === 'completed' ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                        )}
                        onClick={() => updateOrderStatus(order.id, order.status === 'pending' ? 'completed' : 'pending')}
                      >
                        {order.status === 'pending' ? '준비중' : order.status === 'completed' ? '완료됨' : '취소됨'}
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-2xl mx-auto p-8 text-center mt-auto">
        <p className="text-slate-400 text-[10px] font-medium">
          신협직원주문 © 2026 Shinhyup. All rights reserved.
        </p>
      </footer>

      {/* Option Modal */}
      <AnimatePresence>
        {showOptionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowOptionModal(false);
                setSelectedTemp(undefined);
                setSelectedShot('기본');
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl space-y-8"
            >
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-slate-800">{selectedMenu?.name}</h3>
                <p className="text-slate-500">옵션을 선택해주세요.</p>
              </div>

              <div className="space-y-6">
                {/* Temperature Selection */}
                {selectedMenu?.hasOptions && (
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-600">온도</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setSelectedTemp('HOT')}
                        className={cn(
                          "p-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all border-2",
                          selectedTemp === 'HOT' 
                            ? "bg-red-50 border-red-500 text-red-600" 
                            : "bg-slate-50 border-transparent text-slate-400"
                        )}
                      >
                        <Plus size={18} /> HOT
                      </button>
                      <button 
                        onClick={() => setSelectedTemp('ICE')}
                        className={cn(
                          "p-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all border-2",
                          selectedTemp === 'ICE' 
                            ? "bg-blue-50 border-blue-500 text-blue-600" 
                            : "bg-slate-50 border-transparent text-slate-400"
                        )}
                      >
                        <Minus size={18} /> ICE
                      </button>
                    </div>
                  </div>
                )}

                {/* Shot Options */}
                {selectedMenu?.supportsShotOptions && (
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-600">농도 / 샷</label>
                    <div className={cn(
                      "grid gap-2",
                      selectedMenu.name === '에스프레소' ? "grid-cols-2" : "grid-cols-3"
                    )}>
                      {(['연하게', '기본', '샷추가'] as const)
                        .filter(shot => !(selectedMenu.name === '에스프레소' && shot === '연하게'))
                        .map((shot) => (
                          <button
                            key={shot}
                            onClick={() => setSelectedShot(shot)}
                            className={cn(
                              "py-3 rounded-xl text-sm font-bold transition-all border-2",
                              selectedShot === shot
                                ? "bg-shinhyup-blue border-shinhyup-blue text-white"
                                : "bg-slate-50 border-transparent text-slate-400"
                            )}
                          >
                            {shot}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => {
                    setShowOptionModal(false);
                    setSelectedTemp(undefined);
                    setSelectedShot('기본');
                  }}
                  className="flex-1 py-4 text-slate-400 font-medium"
                >
                  취소
                </button>
                <button 
                  disabled={selectedMenu?.hasOptions && !selectedTemp}
                  onClick={() => {
                    if (selectedMenu) {
                      addToCart(selectedMenu, selectedTemp, selectedShot);
                    }
                  }}
                  className="flex-[2] bg-shinhyup-blue text-white py-4 rounded-2xl font-bold shadow-lg shadow-shinhyup-blue/20 disabled:opacity-50"
                >
                  담기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
