/**
 * Tavriko yasal metinleri (tek kaynak).
 * ------------------------------------
 * Bu dosya hem istemcide (kayıt, Google girişi, Ayarlar > Yasal) hem de
 * sunucuda (/legal herkese açık sayfaları) kullanılır.
 *
 * ÖNEMLİ: Metinlerden herhangi biri değiştiğinde LEGAL_VERSION güncellenmelidir.
 * Sürüm değişince oturum açmış kullanıcılardan yeni metinleri tekrar onaylamaları
 * istenir.
 *
 * LEGAL_OPERATOR alanlarındaki köşeli parantezli değerler gerçek veri sorumlusu
 * bilgileriyle (ad/unvan, adres, iletişim e-postası) doldurulmalıdır.
 */
export declare const LEGAL_VERSION = "2026-11-11";
export declare const LEGAL_OPERATOR: {
    appName: string;
    controllerName: string;
    address: string;
    contactEmail: string;
    websiteUrl: string;
};
export type LegalDocumentId = 'terms' | 'privacy' | 'kvkk' | 'cookies' | 'purchases' | 'community';
export interface LegalSection {
    heading: string;
    paragraphs: string[];
}
export interface LegalDocument {
    id: LegalDocumentId;
    title: string;
    shortTitle: string;
    summary: string;
    sections: LegalSection[];
}
/** Kayıt ve girişte onaylanması zorunlu metinler. */
export declare const REQUIRED_LEGAL_DOCUMENTS: LegalDocumentId[];
export interface LegalConsentRecord {
    version: string;
    acceptedAt: string;
    documents: LegalDocumentId[];
    method: 'register' | 'google' | 'in_app';
}
export declare const LEGAL_DOCUMENTS: LegalDocument[];
export declare function getLegalDocument(id: string): LegalDocument | undefined;
/** Kullanıcının mevcut sürüm yasal metinleri onaylayıp onaylamadığını döndürür. */
export declare function hasAcceptedCurrentLegal(settings: unknown): boolean;
