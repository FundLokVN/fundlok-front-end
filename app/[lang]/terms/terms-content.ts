import type { SeoLocale } from "@/lib/seo";

/**
 * The /terms page: Contract 1, "Điều khoản Dịch vụ và Đồng ý xử lý dữ liệu /
 * Terms & Services and Data Consent", version 1.0 FINAL (locked 17 Nov 2026),
 * copied verbatim from the "FundLok money flow and contracts – FINAL v1.0"
 * doc, tab "1. Terms & Services + data consent". If the Vietnamese and
 * English differ, the Vietnamese prevails.
 *
 * Read on the server only (page.tsx), which hands TermsClient the one language
 * the page is in: the full text of both is the bulk of this page, and as part
 * of the client component it was downloaded, parsed and hydrated on every
 * visit, the language nobody was reading included.
 *
 * The sign-up gate (/consent) shows its own copy in lib/legal/terms.ts, tied
 * to TERMS_VERSION and the backend's consent version; that copy is changed
 * separately, because changing it makes every user accept again.
 */
interface ClauseContent {
  /** A clause's own bold label (Article 3); absent where the text runs on. */
  headingVi?: string;
  headingEn?: string;
  contentVi: string[];
  contentEn: string[];
}

interface SectionContent {
  id: string;
  badgeVi: string;
  badgeEn: string;
  titleVi: string;
  titleEn: string;
  items: ClauseContent[];
}

/** Above Article 1: which language prevails, and how the Terms are signed. */
const TERMS_PREFACE: { vi: string; en: string }[] = [
  {
    vi: "Khi có khác biệt giữa bản tiếng Việt và bản tiếng Anh, bản tiếng Việt được ưu tiên áp dụng.",
    en: "If the Vietnamese and English texts differ, the Vietnamese text prevails.",
  },
  {
    vi: "Ký kết: tại màn hình đăng ký, Doanh nghiệp, Nhà đầu tư và người bảo lãnh cá nhân, bằng ba ô đánh dấu riêng biệt và mã OTP gửi qua Zalo; hệ thống ghi nhận phiên bản đã chấp nhận và thời điểm.",
    en: "Signed: on the sign-up screen, by SMEs, investors and personal guarantors, with three separate tick boxes and an OTP sent by Zalo; the system logs the version accepted and the time.",
  },
];

const TERMS_SECTIONS: SectionContent[] = [
  {
    id: "article-1",
    badgeVi: "Điều 1",
    badgeEn: "Article 1",
    titleVi: "Về FundLok",
    titleEn: "About FundLok",
    items: [
      {
        contentVi: [
          'Nền tảng FundLok do Công ty Cổ phần FundLok (mã số doanh nghiệp 1501167629; trụ sở chính: Thửa đất số 31, Tờ bản đồ số 121, khóm Thuận Tiến B, phường Bình Minh, tỉnh Vĩnh Long, Việt Nam) ("FundLok") vận hành. FundLok là nền tảng công nghệ kết nối doanh nghiệp nhỏ và vừa cần vốn lưu động ("Doanh nghiệp") với nhà đầu tư cá nhân và tổ chức ("Nhà đầu tư").',
          "FundLok không phải là tổ chức tín dụng. FundLok không cho vay, không đi vay, không nhận tiền gửi, không giữ tiền của khách hàng và không bảo lãnh cho bất kỳ khoản vay nào.",
        ],
        contentEn: [
          'The FundLok platform is operated by FundLok Joint-Stock Company (enterprise code 1501167629; head office: Land Parcel No. 31, Cadastral Map Sheet No. 121, Thuan Tien B Quarter, Binh Minh Ward, Vinh Long Province, Vietnam) ("FundLok"). FundLok is a technology platform that connects small and medium enterprises needing working capital ("SMEs") with individual and institutional investors ("Investors").',
          "FundLok is not a credit institution. FundLok does not lend, does not borrow, does not take deposits, does not hold customers' money and does not guarantee any loan.",
        ],
      },
    ],
  },
  {
    id: "article-2",
    badgeVi: "Điều 2",
    badgeEn: "Article 2",
    titleVi: "Phạm vi và chấp nhận",
    titleEn: "Scope and acceptance",
    items: [
      {
        contentVi: [
          "2.1. Điều khoản này áp dụng cho mọi người dùng nền tảng. Dịch vụ cụ thể được điều chỉnh thêm bởi Hợp đồng dịch vụ dành cho Doanh nghiệp hoặc Hợp đồng dịch vụ dành cho Nhà đầu tư.",
          "2.2. Người dùng là cá nhân phải là công dân Việt Nam từ đủ 18 tuổi, có năng lực hành vi dân sự đầy đủ. Người dùng là tổ chức phải được thành lập hợp pháp tại Việt Nam và do người đại diện theo pháp luật hoặc người được ủy quyền hợp lệ thao tác.",
          "2.3. Người dùng chấp nhận Điều khoản này bằng cách đánh dấu ô xác nhận và nhập mã OTP gửi qua Zalo tới tài khoản đã đăng ký. Các hợp đồng khác trên nền tảng được ký theo phương thức ghi trong từng hợp đồng: Doanh nghiệp và FundLok ký bằng chữ ký số của doanh nghiệp; Nhà đầu tư và người bảo lãnh ký bằng mã OTP gửi qua Zalo kèm xác nhận được ghi nhận trên nền tảng. Việc chấp nhận điện tử có giá trị như chữ ký theo Luật Giao dịch điện tử 2023.",
        ],
        contentEn: [
          "2.1. These Terms apply to every user of the platform. Specific services are further governed by the SME Service Agreement or the Investor Service Agreement.",
          "2.2. Individual users must be Vietnamese citizens aged 18 or over with full civil capacity. Organisations must be lawfully established in Vietnam and act through their legal representative or a duly authorised person.",
          "2.3. Users accept these Terms by ticking the confirmation box and entering an OTP sent by Zalo to their registered account. Other contracts on the platform are signed by the method stated in each contract: SMEs and FundLok sign with their company digital signatures; Investors and personal guarantors sign with an OTP sent by Zalo and a confirmation logged on the platform. Electronic acceptance has the effect of a signature under the Law on Electronic Transactions 2023.",
        ],
      },
    ],
  },
  {
    id: "article-3",
    badgeVi: "Điều 3",
    badgeEn: "Article 3",
    titleVi: "Thông tin công bố trước khi giao kết",
    titleEn: "Pre-signing disclosures",
    items: [
      {
        contentVi: [
          "Người dùng xác nhận đã đọc và hiểu các nội dung sau trước khi sử dụng dịch vụ:",
        ],
        contentEn: [
          "Users confirm that they have read and understood the following before using the service:",
        ],
      },
      {
        headingVi: "3.1. FundLok không phải là một bên của khoản vay.",
        headingEn: "3.1. FundLok is not a party to any loan.",
        contentVi: [
          "Mỗi khoản vay là hợp đồng riêng giữa một Nhà đầu tư và Doanh nghiệp. FundLok không phải bên cho vay, bên vay, đại diện của bên vay hay bên bảo lãnh.",
        ],
        contentEn: [
          "Each loan is a separate contract between one Investor and the SME. FundLok is not the lender, the borrower, the borrower's agent or a guarantor.",
        ],
      },
      {
        headingVi: "3.2. Không có bảo đảm.",
        headingEn: "3.2. Nothing is guaranteed.",
        contentVi: [
          "FundLok không bảo đảm việc hoàn trả gốc, lãi, hay việc một khoản gọi vốn đủ vốn. Nhà đầu tư có thể mất một phần hoặc toàn bộ số tiền cho vay. FundLok không thu hồi nợ thay Nhà đầu tư; nếu Doanh nghiệp không trả, Nhà đầu tư tự yêu cầu Doanh nghiệp và Người bảo lãnh thực hiện nghĩa vụ.",
        ],
        contentEn: [
          "FundLok does not guarantee repayment of principal or interest, or that a listing will be funded. Investors may lose part or all of the money they lend. FundLok does not collect debts for Investors; if the SME does not pay, the Investor claims against the SME and its personal guarantor itself.",
        ],
      },
      {
        headingVi: "3.3. Tiền chuyển trực tiếp.",
        headingEn: "3.3. Money moves directly.",
        contentVi: [
          "Mọi khoản giải ngân và trả nợ chỉ được chuyển giữa tài khoản ngân hàng chính chủ của Nhà đầu tư và của Doanh nghiệp. Không bao giờ chuyển tiền vay hoặc tiền trả nợ vào tài khoản của FundLok. Chỉ phí dịch vụ của FundLok được thanh toán cho FundLok, theo hóa đơn riêng.",
        ],
        contentEn: [
          "Every disbursement and repayment moves only between the Investor's and the SME's own bank accounts. Never send loan money or repayments to FundLok's account. Only FundLok's service fees are paid to FundLok, against a separate invoice.",
        ],
      },
      {
        headingVi: "3.4. Cách một khoản gọi vốn vận hành.",
        headingEn: "3.4. How a listing works.",
        contentVi: [
          "(a) Trong thời gian tối đa 12 ngày, Nhà đầu tư đăng ký cho vay bằng cách bấm Xác nhận; có thể đăng ký nhiều lần và rút đăng ký đến hết ngày thứ 12 kể từ ngày đăng; chưa ký hợp đồng và chưa có tiền nào được chuyển. Ngày giải ngân là 14 ngày sau ngày đăng.",
          "(b) Đến hạn chấp nhận, 15:00 ngày thứ 13 kể từ ngày đăng, Doanh nghiệp có quyền chấp nhận hoặc không chấp nhận tổng số tiền đã đăng ký; nếu không chấp nhận, không có hợp đồng cho vay nào được giao kết. Khi chấp nhận, Doanh nghiệp (chữ ký số) và người bảo lãnh (OTP) ký ngay từng hợp đồng cho vay. Nếu Doanh nghiệp không phản hồi: tổng số đã đăng ký từ 50% mục tiêu trở lên được coi là chấp nhận; dưới 50% được coi là không chấp nhận; khi được coi là chấp nhận, Doanh nghiệp bị ràng buộc bởi từng hợp đồng cho vay như đã ký.",
          "(c) Nếu Doanh nghiệp chấp nhận, đăng ký của Nhà đầu tư là cuối cùng; vào ngày giải ngân mỗi Nhà đầu tư ký hợp đồng cho vay cho tổng số tiền đã đăng ký bằng mã OTP gửi qua Zalo, rồi chuyển tiền, trước 15 giờ, bằng mã VietQR do nền tảng cung cấp.",
          "(d) Nếu có Nhà đầu tư không chuyển tiền, khoản vay vẫn tiếp tục và phần thiếu hụt được mở lại ngay cho Nhà đầu tư mới, họ đăng ký, ký và chuyển tiền ngay.",
          "(e) Mọi thời hạn tính theo ngày dương lịch và không lùi khi rơi vào ngày nghỉ cuối tuần hoặc ngày nghỉ lễ; kỳ trả nợ rơi vào thứ Hai đến thứ Sáu, kể cả ngày nghỉ lễ.",
        ],
        contentEn: [
          "(a) During a window of up to 12 days, Investors pledge by pressing Confirm; they may pledge more than once and withdraw a pledge until the end of day 12 after the listing date; nothing is signed and no money moves yet. The disbursement day is 14 days after the listing date.",
          "(b) Until the acceptance deadline, 15:00 on day 13 after the listing date, the SME may accept or decline the total pledged; if it declines, no loan contract is concluded. On accepting, the SME (digital signature) and the guarantor (OTP) at once sign each loan contract. If the SME does not respond: pledges of 50% of the target or more count as accepted; below 50% count as declined; when deemed to accept, the SME is bound by each loan contract as if it had signed it.",
          "(c) If the SME accepts, the Investors' pledges are final; on the disbursement day each Investor signs its loan contract for its total pledged with an OTP sent by Zalo, then transfers, before 3 pm, using the VietQR the platform provides.",
          "(d) If an Investor does not transfer, the loan goes ahead and the shortfall reopens at once for new Investors, who pledge, sign and transfer straight away.",
          "(e) Every deadline counts calendar days and does not move when it falls on a weekend or public holiday; instalments fall Monday to Friday, including public holidays.",
        ],
      },
      {
        headingVi: "3.5. Bằng chứng giao dịch.",
        headingEn: "3.5. Evidence.",
        contentVi: [
          'FundLok không có kết nối với ngân hàng. Khi giải ngân, Nhà đầu tư tải ảnh chụp lệnh chuyển và Doanh nghiệp tải ảnh chụp tiền đến; hai ảnh khớp nhau thì khoản giải ngân được xác nhận; nếu Doanh nghiệp không tải ảnh trong 24 giờ, khoản giải ngân được coi là đã nhận. Khi trả nợ, Doanh nghiệp tải ảnh chụp lệnh chuyển trước 18:00 ngày đến hạn (nếu không, kỳ trả được ghi nhận là trễ hạn trên nền tảng; lãi chậm trả tính theo Hợp đồng cho vay); Nhà đầu tư bấm "Đã nhận" hoặc "Chưa nhận"; sau 24 giờ không phản hồi, khoản trả nợ được coi là đã nhận. Trong cả hai trường hợp, bên nhận vẫn có quyền khiếu nại trong 30 ngày kèm sao kê ngân hàng chứng minh chưa nhận được tiền.',
        ],
        contentEn: [
          'FundLok has no connection to any bank. On disbursement, the Investor uploads a screenshot of the transfer and the SME uploads a screenshot of the money arriving; when both match, the disbursement is confirmed; if the SME does not upload within 24 hours, the disbursement counts as received. On repayment, the SME uploads a screenshot of the transfer by 18:00 on the due date (otherwise the day is recorded as late on the platform; late interest follows the Loan Contract); the Investor presses "Received" or "Not received"; with no response within 24 hours, the repayment counts as received. In both cases the receiving party may still dispute within 30 days with a bank statement showing the money did not arrive.',
        ],
      },
      {
        headingVi: "3.6. Phí.",
        headingEn: "3.6. Fees.",
        contentVi: [
          "Doanh nghiệp trả phí kích hoạt 3% trên số tiền giải ngân được xác nhận, chưa gồm VAT. Nhà đầu tư trả phí dịch vụ 2,5%/năm trên gốc, chưa gồm VAT, xuất hóa đơn hằng tháng. Phí không bao giờ bị khấu trừ vào tiền gốc hoặc tiền trả nợ.",
        ],
        contentEn: [
          "SMEs pay a 3% activation fee on the confirmed disbursed amount plus VAT. Investors pay a service fee of 2.5% a year on principal, plus VAT, invoiced monthly. Fees are never deducted from principal or repayments.",
        ],
      },
      {
        headingVi: "3.7. Thuế.",
        headingEn: "3.7. Tax.",
        contentVi: [
          "Doanh nghiệp khấu trừ thuế thu nhập cá nhân 5% trên tiền lãi trả cho Nhà đầu tư cá nhân theo quy định pháp luật về thuế.",
        ],
        contentEn: [
          "The SME withholds 5% personal income tax on interest paid to individual Investors, as tax law requires.",
        ],
      },
      {
        headingVi: "3.8. Rủi ro.",
        headingEn: "3.8. Risks.",
        contentVi: [
          "Rủi ro tín dụng (Doanh nghiệp không trả nợ); rủi ro thanh khoản (không có thị trường thứ cấp, không rút vốn trước hạn); rủi ro tập trung; rủi ro vận hành của nền tảng; rủi ro pháp lý. Kết quả đánh giá của FundLok là thông tin tham khảo, không phải lời khuyên đầu tư.",
        ],
        contentEn: [
          "Credit risk (the SME does not repay); liquidity risk (no secondary market, no early withdrawal); concentration risk; platform operational risk; legal and regulatory risk. FundLok's assessment is information for reference, not investment advice.",
        ],
      },
      {
        headingVi: "3.9. Hạn mức.",
        headingEn: "3.9. Limits.",
        contentVi: [
          "Mỗi lần đăng ký cho vay tối thiểu 10.000.000 đồng (hoặc đúng số còn lại khi còn dưới 10.000.000 đồng) và tối đa bằng số tiền còn lại của Khoản gọi vốn. Dư nợ tối đa của một Doanh nghiệp trên nền tảng: 100.000.000 đồng.",
        ],
        contentEn: [
          "Each pledge is at least VND 10,000,000 (or exactly the remainder when less than VND 10,000,000 is left) and at most the amount still open on the Listing. Maximum outstanding per SME on the platform: VND 100,000,000.",
        ],
      },
    ],
  },
  {
    id: "article-4",
    badgeVi: "Điều 4",
    badgeEn: "Article 4",
    titleVi: "Tài khoản và nghĩa vụ người dùng",
    titleEn: "Accounts and user obligations",
    items: [
      {
        contentVi: [
          "4.1. Người dùng cung cấp thông tin trung thực, đầy đủ và cập nhật khi thay đổi; chỉ dùng tài khoản ngân hàng đứng tên chính mình; không thao tác thay hoặc nhân danh người khác; bảo mật thông tin đăng nhập và OTP.",
          "4.2. Người dùng tuân thủ quy định về phòng, chống rửa tiền. FundLok có quyền tạm khóa tài khoản và từ chối giao dịch khi có dấu hiệu gian lận hoặc vi phạm pháp luật. Người dùng cung cấp tài liệu giả mạo hoặc bị chỉnh sửa (ảnh chụp giao dịch, sao kê ngân hàng, tờ khai thuế, giấy tờ định danh) bị tạm khóa tài khoản để xác minh; khi gian lận được xác nhận, tài khoản bị khóa vĩnh viễn, FundLok tố giác với cơ quan nhà nước có thẩm quyền, và khoản vay liên quan được xử lý theo Hợp đồng cho vay.",
          "4.3. Khi Doanh nghiệp chấp nhận hoặc được coi là chấp nhận, Nhà đầu tư đã đăng ký cho vay mà không ký hoặc không chuyển tiền trước 15 giờ Ngày giải ngân sẽ bị khóa tài khoản ngay. Để mở lại ở lần đăng nhập tiếp theo, Nhà đầu tư phải xác minh danh tính (eKYC) lại và tự nhập câu xác nhận đã hiểu hậu quả và không tái phạm. Nếu tái phạm, tài khoản bị khóa vĩnh viễn. Các biện pháp này không áp dụng nếu Nhà đầu tư chứng minh được sự kiện bất khả kháng hoặc sự cố của hệ thống ngân hàng.",
          "4.4. Nhà đầu tư chỉ yêu cầu thu hồi khoản nợ của mình bằng biện pháp hợp pháp: thương lượng, yêu cầu người bảo lãnh, khởi kiện tại Tòa án, hoặc chuyển giao quyền đòi nợ cho bên mua nợ được phép hoạt động. Nhà đầu tư không đe dọa, quấy rối hay thuê dịch vụ đòi nợ. Vi phạm là căn cứ để FundLok chấm dứt tài khoản theo Điều 8.",
        ],
        contentEn: [
          "4.1. Users provide true and complete information and update it when it changes; use only bank accounts in their own name; do not act for or in the name of another person; keep their login details and OTPs secure.",
          "4.2. Users comply with anti-money-laundering rules. FundLok may suspend an account and refuse a transaction where there are signs of fraud or a breach of law. A user who provides forged or altered documents (transfer screenshots, bank statements, tax declarations, identity documents) has the account suspended for verification; once fraud is confirmed, the account is closed permanently, FundLok reports the conduct to the competent authorities, and the related loan is dealt with under the Loan Contract.",
          "4.3. Once the SME accepts or is deemed to accept, an Investor who pledged but does not sign or does not transfer before 3 pm on the Disbursement Date has its account locked at once. To unlock it at the next log-on, the Investor must complete identity verification (eKYC) again and type a sentence acknowledging the consequences and undertaking not to repeat. A repeat means the account is closed permanently. These measures do not apply if the Investor proves force majeure or a banking-system outage.",
          "4.4. An Investor pursues its own claim only by lawful means: negotiation, calling on the personal guarantor, court action, or transferring the claim to a licensed debt buyer. The Investor must not threaten, harass or hire debt collectors. A breach is a ground for FundLok to close the account under Article 8.",
        ],
      },
    ],
  },
  {
    id: "article-5",
    badgeVi: "Điều 5",
    badgeEn: "Article 5",
    titleVi: "Vai trò và giới hạn trách nhiệm của FundLok",
    titleEn: "FundLok's role and limits of liability",
    items: [
      {
        contentVi: [
          "5.1. FundLok cung cấp nền tảng, thẩm định hồ sơ, tạo mã QR, tính lịch trả nợ, lưu trữ hồ sơ và gửi thông báo. FundLok không quyết định đầu tư thay Nhà đầu tư và không ký hay vay thay Doanh nghiệp.",
          "5.2. FundLok không chịu trách nhiệm về việc Doanh nghiệp không trả nợ hoặc Nhà đầu tư không chuyển tiền. FundLok chịu trách nhiệm đối với thiệt hại phát sinh do lỗi của chính FundLok theo quy định pháp luật.",
        ],
        contentEn: [
          "5.1. FundLok provides the platform, assesses applications, generates QR codes, computes repayment schedules, keeps records and sends notices. FundLok does not make investment decisions for Investors and does not sign or borrow for SMEs.",
          "5.2. FundLok is not liable for an SME failing to repay or an Investor failing to transfer. FundLok is liable for losses caused by its own fault as the law provides.",
        ],
      },
    ],
  },
  {
    id: "article-6",
    badgeVi: "Điều 6",
    badgeEn: "Article 6",
    titleVi: "Thông báo và hồ sơ điện tử",
    titleEn: "Notices and electronic records",
    items: [
      {
        contentVi: [
          "Thông báo được gửi qua ứng dụng, Zalo hoặc email đã đăng ký; mọi mã OTP được gửi qua Zalo. Hồ sơ điện tử trên nền tảng (hợp đồng, ảnh chụp giao dịch, nhật ký thao tác) được lưu trữ và có thể dùng làm chứng cứ. Người dùng có thể xem và tải bản điện tử của mọi hợp đồng mình đã ký trên nền tảng; mỗi bản có giá trị pháp lý như nhau.",
        ],
        contentEn: [
          "Notices are sent through the app, or to the registered Zalo or email; every OTP is sent by Zalo. Electronic records on the platform (contracts, transfer screenshots, activity logs) are kept and may be used as evidence. Users can view and download an electronic copy of every contract they have signed on the platform; every copy has the same legal force.",
        ],
      },
    ],
  },
  {
    id: "article-7",
    badgeVi: "Điều 7",
    badgeEn: "Article 7",
    titleVi: "Sửa đổi Điều khoản",
    titleEn: "Changes to these Terms",
    items: [
      {
        contentVi: [
          "FundLok thông báo trước ít nhất 30 ngày khi sửa đổi Điều khoản này. Người dùng không đồng ý có thể đóng tài khoản theo Điều 8 trước ngày sửa đổi có hiệu lực. Sửa đổi không làm thay đổi hợp đồng cho vay hay hợp đồng dịch vụ đã ký.",
        ],
        contentEn: [
          "FundLok gives at least 30 days' notice of changes to these Terms. A user who does not agree may close their account under Article 8 before the change takes effect. Changes never alter loan contracts or service agreements already signed.",
        ],
      },
    ],
  },
  {
    id: "article-8",
    badgeVi: "Điều 8",
    badgeEn: "Article 8",
    titleVi: "Tạm ngừng và chấm dứt",
    titleEn: "Suspension and termination",
    items: [
      {
        contentVi: [
          "Người dùng có thể đóng tài khoản khi không còn khoản vay, cam kết hoặc phí chưa thanh toán. FundLok có thể chấm dứt tài khoản khi người dùng vi phạm nghiêm trọng, sau khi thông báo. Nghĩa vụ phát sinh trước khi chấm dứt vẫn tiếp tục.",
        ],
        contentEn: [
          "Users may close their account when no loan, commitment or fee remains outstanding. FundLok may close an account for a serious breach, after notice. Obligations arising before closure continue.",
        ],
      },
    ],
  },
  {
    id: "article-9",
    badgeVi: "Điều 9",
    badgeEn: "Article 9",
    titleVi: "Luật áp dụng và giải quyết tranh chấp",
    titleEn: "Governing law and disputes",
    items: [
      {
        contentVi: [
          "Điều khoản này tuân theo pháp luật Việt Nam. Tranh chấp được ưu tiên thương lượng trong 30 ngày; sau đó do Tòa án có thẩm quyền của Việt Nam giải quyết, hoặc Trung tâm Trọng tài Quốc tế Việt Nam (VIAC) nếu các bên thỏa thuận bằng văn bản.",
        ],
        contentEn: [
          "These Terms are governed by Vietnamese law. Disputes are first negotiated for 30 days; then they go to the competent Vietnamese court, or to the Vietnam International Arbitration Centre (VIAC) if the parties agree in writing.",
        ],
      },
    ],
  },
  {
    id: "article-10",
    badgeVi: "Điều 10",
    badgeEn: "Article 10",
    titleVi: "Đồng ý xử lý dữ liệu cá nhân (ô đánh dấu riêng)",
    titleEn: "Personal data consent (separate tick box)",
    items: [
      {
        contentVi: [
          "10.1. Bên kiểm soát dữ liệu: FundLok. Dữ liệu: thông tin định danh, giấy tờ tùy thân, ảnh khuôn mặt, thông tin liên hệ, tài khoản ngân hàng; với Doanh nghiệp, thêm hồ sơ pháp lý, báo cáo tài chính, sao kê và các giấy tờ Doanh nghiệp tự tải lên; với người bảo lãnh cá nhân của Doanh nghiệp, thông tin định danh, giấy tờ tùy thân, ảnh khuôn mặt và thông tin liên hệ. Ảnh khuôn mặt và thông tin tài khoản ngân hàng là dữ liệu cá nhân nhạy cảm.",
          "10.2. Mục đích: định danh và xác thực khách hàng (eKYC), phòng chống rửa tiền, thẩm định hồ sơ vay, thực hiện hợp đồng, kể cả cung cấp cho các bên của cùng hợp đồng cho vay (Doanh nghiệp, Nhà đầu tư, người bảo lãnh) các thông tin ghi trong hợp đồng đó, báo cáo theo yêu cầu của cơ quan nhà nước có thẩm quyền, phát hiện gian lận và tố giác hành vi vi phạm pháp luật với cơ quan có thẩm quyền.",
          "10.3. Chia sẻ cho bên xử lý (ô đánh dấu riêng): FundLok chia sẻ dữ liệu định danh với Công ty TPV Datatrust để thực hiện eKYC và xác minh doanh nghiệp (eKYB). TPV Datatrust chỉ xử lý theo chỉ dẫn của FundLok và không lưu trữ dữ liệu. FundLok không bán dữ liệu cá nhân.",
          "10.4. Quyền của chủ thể dữ liệu: được biết, truy cập, chỉnh sửa, rút lại sự đồng ý và yêu cầu xóa theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15. Rút lại sự đồng ý không ảnh hưởng đến xử lý đã thực hiện trước đó và đến dữ liệu phải lưu trữ theo luật; khi rút lại, người dùng có thể không tiếp tục sử dụng được dịch vụ.",
          "10.5. Lưu trữ: trong thời hạn theo quy định của pháp luật.",
          "10.6. Việc tra cứu thông tin tín dụng (CIC) và kết nối dữ liệu ngân hàng chưa được thực hiện; khi triển khai, FundLok sẽ xin đồng ý riêng.",
          "10.7. Lưu trữ ở nước ngoài (cùng ô đánh dấu với Điều 10.3): Dữ liệu của người dùng, gồm dữ liệu cá nhân và các tài liệu tải lên, có thể được lưu trữ và xử lý trên hạ tầng điện toán đám mây của các nhà cung cấp dịch vụ do FundLok thuê, có thể có máy chủ đặt ngoài lãnh thổ Việt Nam. Khi đó, đây là việc chuyển dữ liệu cá nhân ra nước ngoài theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15. Mục đích: vận hành nền tảng, lưu trữ hồ sơ và sao lưu. Các nhà cung cấp chỉ lưu trữ và xử lý theo chỉ dẫn của FundLok và không được dùng dữ liệu cho mục đích riêng. FundLok áp dụng các biện pháp bảo mật và phân quyền truy cập, thực hiện các thủ tục chuyển dữ liệu ra nước ngoài theo quy định pháp luật, và có thể thay đổi nhà cung cấp hoặc nơi lưu trữ, kể cả chuyển về Việt Nam.",
          "10.8. Hậu quả không mong muốn có thể xảy ra: Dù FundLok áp dụng các biện pháp bảo vệ, dữ liệu vẫn có thể bị truy cập trái phép, lộ hoặc mất do tấn công mạng, sự cố hệ thống của FundLok hoặc của bên xử lý dữ liệu, hoặc sự kiện bất khả kháng. Khi đó dữ liệu có thể bị dùng sai mục đích và dịch vụ có thể bị gián đoạn. FundLok thông báo cho người dùng và cơ quan có thẩm quyền theo quy định pháp luật.",
        ],
        contentEn: [
          "10.1. Controller: FundLok. Data: identity details, ID documents, face image, contact details, bank account; for SMEs, also legal documents, financial statements, statements and other papers the SME uploads itself; for the SME's personal guarantor, identity details, ID documents, face image and contact details. Face images and bank-account details are sensitive personal data.",
          "10.2. Purposes: identifying and verifying customers (eKYC), anti-money laundering, assessing loan applications, performing contracts, including giving the parties to the same loan contract (SME, Investor, guarantor) the details written in that contract, reporting as competent authorities require, detecting fraud, and reporting suspected breaches of law to the competent authorities.",
          "10.3. Sharing with a processor (separate tick box): FundLok shares identity data with TPV Datatrust to perform eKYC and business verification (eKYB). TPV Datatrust processes only on FundLok's instructions and does not store the data. FundLok does not sell personal data.",
          "10.4. Data subject rights: to be informed, access, correct, withdraw consent and request deletion under the Law on Personal Data Protection No. 91/2025/QH15. Withdrawal does not affect processing already done or data the law requires to be kept; after withdrawal the user may no longer be able to use the service.",
          "10.5. Retention: for the periods the law requires.",
          "10.6. Credit-bureau (CIC) lookups and bank-data connections are not in use; when introduced, FundLok will ask for separate consent.",
          "10.7. Overseas storage (same tick box as Article 10.3): Users' data, including personal data and uploaded documents, may be stored and processed on the cloud infrastructure of service providers engaged by FundLok, which may have servers located outside Vietnam. Where that is the case, it is a transfer of personal data abroad under the Law on Personal Data Protection No. 91/2025/QH15. Purposes: running the platform, keeping records and backups. The providers store and process only on FundLok's instructions and may not use the data for their own purposes. FundLok applies security and access controls, completes the cross-border transfer procedures the law requires, and may change provider or storage location, including moving the data to Vietnam.",
          "10.8. Unwanted consequences that may occur: Despite FundLok's safeguards, data may still be accessed without authority, leaked or lost through a cyberattack, a system failure at FundLok or at a data processor, or force majeure. The data could then be misused and the service interrupted. FundLok notifies users and the competent authorities as the law requires.",
        ],
      },
    ],
  },
  {
    id: "sign-up-tick-boxes",
    badgeVi: "Ô xác nhận",
    badgeEn: "Tick boxes",
    titleVi: "Ô xác nhận trên màn hình đăng ký",
    titleEn: "Tick boxes on the sign-up screen",
    items: [
      {
        contentVi: [
          "☐ Tôi đã đọc và đồng ý Điều khoản Dịch vụ và các thông tin công bố tại Điều 3.",
          "☐ Tôi đồng ý FundLok xử lý dữ liệu cá nhân của tôi theo Điều 10.1–10.2.",
          "☐ Tôi đồng ý FundLok chia sẻ dữ liệu định danh với TPV Datatrust để eKYC/eKYB theo Điều 10.3, và việc lưu trữ, xử lý dữ liệu của tôi trên hạ tầng điện toán đám mây có thể đặt ngoài Việt Nam theo Điều 10.7.",
        ],
        contentEn: [
          "☐ I have read and agree to the Terms & Services and the disclosures in Article 3.",
          "☐ I consent to FundLok processing my personal data under Articles 10.1–10.2.",
          "☐ I consent to FundLok sharing my identity data with TPV Datatrust for eKYC and eKYB under Article 10.3, and to my data being stored and processed on cloud infrastructure that may be located outside Vietnam under Article 10.7.",
        ],
      },
    ],
  },
];

/** One section of the terms in a single language, as TermsClient renders it. */
export interface TermsSection {
  id: string;
  badge: string;
  title: string;
  items: { heading?: string; content: string[] }[];
}

export function termsPrefaceFor(locale: SeoLocale): string[] {
  return TERMS_PREFACE.map((line) => (locale === "vi" ? line.vi : line.en));
}

export function termsSectionsFor(locale: SeoLocale): TermsSection[] {
  const isVi = locale === "vi";
  return TERMS_SECTIONS.map((sec) => ({
    id: sec.id,
    badge: isVi ? sec.badgeVi : sec.badgeEn,
    title: isVi ? sec.titleVi : sec.titleEn,
    items: sec.items.map((item) => ({
      heading: isVi ? item.headingVi : item.headingEn,
      content: isVi ? item.contentVi : item.contentEn,
    })),
  }));
}
