import { useState } from 'react';
import { DollarSign, Plus, Trash2, AlertOctagon, Car, Utensils, Home, Ticket, ShoppingBag, Layers } from 'lucide-react';
import './BudgetTracker.css';

const CATEGORIES = [
  { id: 'transport', label: '交通费', icon: Car, color: '#06b6d4' },
  { id: 'food', label: '餐饮开销', icon: Utensils, color: '#f59e0b' },
  { id: 'lodging', label: '住宿酒店', icon: Home, color: '#3b82f6' },
  { id: 'tickets', label: '门票娱乐', icon: Ticket, color: '#10b981' },
  { id: 'shopping', label: '购物手信', icon: ShoppingBag, color: '#ec4899' },
  { id: 'other', label: '其他杂项', icon: Layers, color: '#6b7280' }
];

export default function BudgetTracker({
  destinations = [],
  expenses = [],
  totalBudget = 3000,
  onAddExpense,
  onRemoveExpense,
  onUpdateBudget
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [expName, setExpName] = useState('');
  const [expCategory, setExpCategory] = useState('food');
  const [expAmount, setExpAmount] = useState('');
  const [expDestId, setExpDestId] = useState('');
  const [tempBudget, setTempBudget] = useState(totalBudget);
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  // Sum up total expenses
  const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const percentUsed = Math.min(Math.round((totalSpent / totalBudget) * 100), 999);
  const remaining = totalBudget - totalSpent;
  const isOverBudget = totalSpent > totalBudget;

  const handleSubmitExpense = (e) => {
    e.preventDefault();
    if (!expName.trim() || !expAmount || parseFloat(expAmount) <= 0) return;

    onAddExpense({
      id: Date.now().toString(),
      name: expName,
      category: expCategory,
      amount: parseFloat(expAmount),
      destinationId: expDestId || 'general',
      date: new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    });

    // Reset Form
    setExpName('');
    setExpAmount('');
    setExpDestId('');
    setShowAddForm(false);
  };

  const handleBudgetSave = () => {
    onUpdateBudget(parseFloat(tempBudget) || 1000);
    setIsEditingBudget(false);
  };

  // Group expenses by category for analytics
  const getCategorySpent = (catId) => {
    return expenses
      .filter(e => e.category === catId)
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  };

  return (
    <div className="budget-tracker-panel">
      <h2 className="section-title">
        <DollarSign size={18} className="neon-cyan" />
        旅行预算账单
      </h2>

      {/* Budget Dashboard Meter */}
      <div className={`budget-dashboard glass-panel ${isOverBudget ? 'warning-pulse' : ''}`}>
        <div className="budget-dash-top">
          <div className="budget-title-block">
            <span className="dash-label">旅行总预算</span>
            {isEditingBudget ? (
              <div className="budget-edit-input">
                <input
                  type="number"
                  className="input-text budget-inline-input"
                  value={tempBudget}
                  onChange={(e) => setTempBudget(e.target.value)}
                />
                <button className="btn-save-budget" onClick={handleBudgetSave}>保存</button>
              </div>
            ) : (
              <h3 className="budget-number" onClick={() => setIsEditingBudget(true)} title="点击修改预算">
                ¥{totalBudget}
                <span className="edit-tip">点击编辑</span>
              </h3>
            )}
          </div>
          <div className="budget-percent-badge" style={{ 
            color: isOverBudget ? 'var(--accent-error)' : percentUsed > 80 ? 'var(--accent-warning)' : 'var(--accent-success)'
          }}>
            <span>{percentUsed}%</span>
          </div>
        </div>

        {/* Dynamic Neon Meter */}
        <div className="budget-meter-track">
          <div 
            className={`budget-meter-fill ${isOverBudget ? 'over' : percentUsed > 80 ? 'warning' : 'safe'}`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          ></div>
        </div>

        <div className="budget-dash-bottom">
          <div className="dash-sub-box">
            <span className="sub-label">已支出金额</span>
            <span className="sub-val text-spent">¥{totalSpent.toFixed(1)}</span>
          </div>
          <div className="dash-vertical-divider"></div>
          <div className="dash-sub-box">
            <span className="sub-label">{isOverBudget ? '超支额' : '剩余可用'}</span>
            <span className={`sub-val ${isOverBudget ? 'text-over' : 'text-remaining'}`}>
              ¥{Math.abs(remaining).toFixed(1)}
            </span>
          </div>
        </div>

        {isOverBudget && (
          <div className="over-budget-warning">
            <AlertOctagon size={13} />
            <span>旅行预算已超支！请合理控制娱乐和购物开销。</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="budget-action-row">
        <button 
          className="btn-primary w-full"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={16} />
          {showAddForm ? '隐藏账单表单' : '录入一笔旅行开销'}
        </button>
      </div>

      {/* Add Expense Form Card */}
      {showAddForm && (
        <form onSubmit={handleSubmitExpense} className="add-expense-form glass-panel">
          <div className="form-row-grid">
            <div className="form-group-mini">
              <label>账目名称</label>
              <input
                type="text"
                className="input-text"
                placeholder="例如: 故宫门票、酒店住宿..."
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                required
              />
            </div>
            <div className="form-group-mini">
              <label>金额 (¥)</label>
              <input
                type="number"
                step="0.1"
                className="input-text"
                placeholder="0.00"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row-grid">
            <div className="form-group-mini">
              <label>费用分类</label>
              <select
                className="select-input-ledg"
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group-mini">
              <label>关联目的地 <span className="opt-span">(可选)</span></label>
              <select
                className="select-input-ledg"
                value={expDestId}
                onChange={(e) => setExpDestId(e.target.value)}
              >
                <option value="">全行程通用</option>
                {destinations.map((dest, idx) => (
                  <option key={dest.id} value={dest.id}>{idx + 1}. {dest.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-submit-row">
            <button type="submit" className="btn-primary-mini">
              确认记账
            </button>
          </div>
        </form>
      )}

      {/* Category breakdown meters */}
      {expenses.length > 0 && (
        <div className="category-breakdown-card glass-panel">
          <span className="analytics-card-title">支出结构占比</span>
          <div className="breakdown-grid">
            {CATEGORIES.map(cat => {
              const spent = getCategorySpent(cat.id);
              if (spent === 0) return null;
              const catPercent = Math.round((spent / totalSpent) * 100);
              const CatIcon = cat.icon;
              
              return (
                <div key={cat.id} className="breakdown-item">
                  <div className="breakdown-info">
                    <div className="breakdown-label">
                      <CatIcon size={12} style={{ color: cat.color }} />
                      <span>{cat.label}</span>
                    </div>
                    <span className="breakdown-amount">¥{spent.toFixed(1)} ({catPercent}%)</span>
                  </div>
                  <div className="breakdown-mini-track">
                    <div className="breakdown-mini-fill" style={{ width: `${catPercent}%`, backgroundColor: cat.color }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ledger list */}
      <div className="ledger-scroll-area">
        {expenses.length === 0 ? (
          <div className="ledger-empty">
            <p>暂无账单数据，赶快录入您的首笔开销吧！</p>
          </div>
        ) : (
          <div className="ledger-items-list">
            {expenses.map((expense) => {
              const category = CATEGORIES.find(c => c.id === expense.category) || CATEGORIES[5];
              const CatIcon = category.icon;
              const associatedDest = destinations.find(d => d.id === expense.destinationId);

              return (
                <div key={expense.id} className="ledger-card glass-panel">
                  <div className="ledger-left">
                    <div className="ledger-cat-icon-box" style={{ backgroundColor: `${category.color}20`, border: `1px solid ${category.color}40` }}>
                      <CatIcon size={14} style={{ color: category.color }} />
                    </div>
                    <div className="ledger-details">
                      <h4>{expense.name}</h4>
                      <div className="ledger-metadata">
                        <span className="ledger-date">{expense.date}</span>
                        {associatedDest && (
                          <span className="ledger-dest-tag">
                            @{associatedDest.name.substring(0, 6)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ledger-right">
                    <span className="ledger-price" style={{ color: category.color }}>¥{expense.amount.toFixed(1)}</span>
                    <button 
                      className="btn-icon danger delete-ledger-btn"
                      onClick={() => onRemoveExpense(expense.id)}
                      title="删除记账"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
