import budget from "./budget/vi"
import ledger from "./ledger/vi"
import accounting from "./accounting/vi"
import projects from "./projects/vi"
import pos from "./pos/vi"
import products from "./products/vi"
import purchase from "./purchase/vi"
import crm from "./crm/vi"
import sales from "./sales/vi"
import dashboard from "./dashboard/vi"
import saas from "./saas/vi"
import admin from "./admin/vi"
import type en from "./en"

const vi: Record<keyof typeof en, string> = {
  "common.email": "Email",
  "common.password": "Mật khẩu",
  "common.confirmPassword": "Xác nhận mật khẩu",
  "common.name": "Họ tên",
  "common.required": "Trường này là bắt buộc",
  "common.invalidEmail": "Nhập địa chỉ email hợp lệ",
  "common.minLength": "Tối thiểu {n} ký tự",
  "common.passwordsDiffer": "Mật khẩu không khớp",
  "common.save": "Lưu thay đổi",
  "common.saving": "Đang lưu…",
  "common.cancel": "Hủy",
  "common.language": "Ngôn ngữ",
  "common.showPassword": "Hiện mật khẩu",
  "common.hidePassword": "Ẩn mật khẩu",
  "common.backToLogin": "Quay lại đăng nhập",

  "auth.side.title1": "Tối ưu vận hành doanh nghiệp",
  "auth.side.title2": "Thông minh hơn với",
  "auth.side.subtitle": "Quản lý Nhân sự, Kế toán, POS, Tuyển dụng, Sản phẩm và Hợp đồng — tất cả trên một nền tảng.",
  "auth.side.overview": "Tổng quan vận hành ERP",
  "auth.side.hrm": "Nhân sự",
  "auth.side.accounting": "Kế toán",
  "auth.side.pos": "POS & Sản phẩm",
  "auth.side.recruitment": "Tuyển dụng",
  "auth.side.contracts": "Hợp đồng hiệu lực",
  "auth.side.revenue": "Tổng doanh thu",
  "auth.side.thisWeek": "tuần này",
  "auth.side.vsLastMonth": "so với tháng trước",

  "login.title": "Đăng nhập",
  "login.subtitle": "Chào mừng trở lại! Nhập thông tin để tiếp tục.",
  "login.emailPlaceholder": "Nhập email",
  "login.passwordPlaceholder": "Nhập mật khẩu",
  "login.remember": "Ghi nhớ đăng nhập",
  "login.forgot": "Quên mật khẩu?",
  "login.submit": "Đăng nhập",
  "login.submitting": "Đang đăng nhập…",
  "login.noAccount": "Chưa có tài khoản?",
  "login.register": "Đăng ký",
  "login.resend": "Gửi lại email xác minh",
  "login.resent": "Nếu tài khoản tồn tại, liên kết xác minh mới đã được gửi.",

  "initial.title": "Đặt mật khẩu mới",
  "initial.subtitle": "Mật khẩu của bạn là mật khẩu tạm. Hãy đặt mật khẩu mới để tiếp tục.",
  "initial.newPassword": "Mật khẩu mới",
  "initial.submit": "Đặt mật khẩu và đăng nhập",

  "register.title": "Đăng ký",
  "register.subtitle": "Tạo tài khoản công ty của bạn.",
  "register.companyName": "Tên công ty",
  "register.companyHint": "Không bắt buộc — để trống sẽ dùng họ tên của bạn",
  "register.submit": "Đăng ký",
  "register.haveAccount": "Đã có tài khoản?",
  "register.login": "Đăng nhập",
  "register.disabled": "Chức năng đăng ký đang tắt. Vui lòng liên hệ quản trị viên.",
  "register.done": "Tài khoản đã được tạo.",
  "register.checkEmail": "Chúng tôi đã gửi liên kết xác minh tới {email}. Mở liên kết trước khi đăng nhập.",

  "forgot.title": "Quên mật khẩu",
  "forgot.subtitle": "Nhập email, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.",
  "forgot.submit": "Gửi liên kết đặt lại mật khẩu",
  "forgot.sent": "Nếu email có tài khoản, liên kết đặt lại đã được gửi. Liên kết có hiệu lực 30 phút.",

  "reset.title": "Đặt lại mật khẩu",
  "reset.subtitle": "Chọn mật khẩu mới cho tài khoản của bạn.",
  "reset.submit": "Đặt lại mật khẩu",
  "reset.done": "Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới.",
  "reset.noToken": "Liên kết đặt lại bị thiếu hoặc không đầy đủ. Hãy yêu cầu liên kết mới.",

  "verify.title": "Xác minh email",
  "verify.checking": "Đang xác minh email…",
  "verify.done": "Email đã được xác minh. Bạn có thể đăng nhập.",
  "verify.noToken": "Liên kết xác minh bị thiếu hoặc không đầy đủ.",

  "profile.title": "Hồ sơ",
  "profile.subtitle": "Quản lý thông tin cá nhân và mật khẩu.",
  "profile.info": "Thông tin cá nhân",
  "profile.infoDesc": "Họ tên, email, số điện thoại và ảnh đại diện.",
  "profile.username": "Tên đăng nhập",
  "profile.mobile": "Số điện thoại",
  "profile.mobileInvalid": "Chỉ dùng chữ số, khoảng trắng và + ( ) - .",
  "profile.photo": "Ảnh đại diện",
  "profile.photoHint": "JPG, PNG hoặc GIF, tối đa 2 MB",
  "profile.photoTooLarge": "Ảnh tối đa 2 MB",
  "profile.photoType": "Chỉ chấp nhận ảnh JPG, PNG hoặc GIF",
  "profile.upload": "Tải lên",
  "profile.remove": "Xóa",
  "profile.saved": "Đã cập nhật hồ sơ",
  "profile.password": "Đổi mật khẩu",
  "profile.passwordDesc": "Sau khi đổi, mọi phiên đăng nhập kết thúc và bạn cần đăng nhập lại.",
  "profile.currentPassword": "Mật khẩu hiện tại",
  "profile.newPassword": "Mật khẩu mới",
  "profile.passwordChanged": "Đã đổi mật khẩu. Vui lòng đăng nhập lại.",

  "menu.dashboard": "Tổng quan",
  "dashboard.welcome": "Xin chào, {name}",
  "menu.profile": "Hồ sơ",
  "menu.logout": "Đăng xuất",
  ...admin,
  ...saas,
  ...dashboard,
  ...sales,
  ...crm,
  ...purchase,
  ...products,
  ...pos,
  ...projects,
  ...accounting,
  ...ledger,
  ...budget,
}

export default vi
