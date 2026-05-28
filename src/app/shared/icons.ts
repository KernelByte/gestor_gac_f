/**
 * Set canónico de iconos Lucide registrados en la app.
 * Todos los componentes deben importar iconos desde aquí
 * para mantener tree-shaking y stroke unificado.
 */
import {
  LucideAngularModule,
  // navegación / acciones
  Plus, Minus, X, Check, Edit2, Trash2, Search, Filter, MoreVertical, MoreHorizontal,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, ArrowUpRight,
  // estados / feedback
  AlertTriangle, AlertCircle, CheckCircle2, Info, RefreshCw, Loader2, XCircle,
  // dominio
  Users, User, UserPlus, MapPin, Calendar, FileText, BarChart3, Settings, Home, LogOut, Bell,
  Folder, FolderOpen, FolderPlus, Inbox, Mail, Phone, Eye, EyeOff,
  // utilidad
  Copy, Download, Upload, ExternalLink, Link as LinkIcon, Lock, Unlock, HelpCircle, Star,
} from 'lucide-angular';

export const APP_ICONS = {
  // navegación / acciones
  Plus, Minus, X, Check, Edit2, Trash2, Search, Filter, MoreVertical, MoreHorizontal,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, ArrowUpRight,
  // estados / feedback
  AlertTriangle, AlertCircle, CheckCircle2, Info, RefreshCw, Loader2, XCircle,
  // dominio
  Users, User, UserPlus, MapPin, Calendar, FileText, BarChart3, Settings, Home, LogOut, Bell,
  Folder, FolderOpen, FolderPlus, Inbox, Mail, Phone, Eye, EyeOff,
  // utilidad
  Copy, Download, Upload, ExternalLink, Link: LinkIcon, Lock, Unlock, HelpCircle, Star,
};

/** Para usar en app.config.ts:  importProvidersFrom(LucideAngularModule.pick(APP_ICONS)) */
export { LucideAngularModule };
