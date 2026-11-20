import React from 'react';
import { BarChart3, Database, FilePlus2, History, Home, LogOut, Menu, Settings } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

interface HeaderProps {
  pricingCount: number;
  quotesCount: number;
  canEditQuotes: boolean;
  canManagePricing: boolean;
  onLogout: () => void;
}

export function visiblePrimaryNavigation(canEditQuotes: boolean, canManagePricing: boolean) {
  return [
    { path: '/', label: '업무 홈' },
    ...(canEditQuotes ? [{ path: '/wizard', label: '견적 작성' }] : []),
    { path: '/history', label: '견적 관리' },
    ...(canManagePricing ? [{ path: '/pricing', label: '단가 관리' }] : []),
  ];
}

const navClass = ({ isActive }: { isActive: boolean }) => `app-nav-link${isActive ? ' active' : ''}`;

export const Header: React.FC<HeaderProps> = ({ pricingCount, quotesCount, canEditQuotes, canManagePricing, onLogout }) => (
  <header className="app-header">
    <div className="header-inner">
      <Link to="/" className="product-brand" aria-label="Queen OS 업무 홈">
        <img src="/queen-os.png" alt="" />
        <span><strong>Queen OS</strong><small>주방가구 견적 업무</small></span>
      </Link>
      <nav className="app-nav" aria-label="주요 메뉴">
        <NavLink to="/" end className={navClass}><Home aria-hidden="true" />업무 홈</NavLink>
        {canEditQuotes && <NavLink to="/wizard" className={navClass}><FilePlus2 aria-hidden="true" />견적 작성</NavLink>}
        <NavLink to="/history" className={navClass}><History aria-hidden="true" />견적 관리 <span>{quotesCount}</span></NavLink>
        {canManagePricing && <NavLink to="/pricing" className={navClass}><Database aria-hidden="true" />단가 관리 <span>{pricingCount}</span></NavLink>}
      </nav>
      <div className="secondary-nav">
        <NavLink to="/ai-accuracy" className={navClass} title="AI 추출 정확도"><BarChart3 aria-hidden="true" /><span>분석</span></NavLink>
        <NavLink to="/architecture" className={navClass} title="시스템 구성"><Settings aria-hidden="true" /><span>설정</span></NavLink>
        <button type="button" onClick={onLogout} className="logout-button"><LogOut aria-hidden="true" /><span>로그아웃</span></button>
      </div>
      <Menu className="mobile-menu-hint" aria-hidden="true" />
    </div>
  </header>
);
