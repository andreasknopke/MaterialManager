import { RowDataPacket } from 'mysql2';

export interface ResolvedGtins {
	scannedGtin: string;
	gtins: string[];
	matchedViaAlias: boolean;
}

async function ensureProductGtinAliasesTable(db: any): Promise<void> {
	await db.query(`
		CREATE TABLE IF NOT EXISTS product_gtin_aliases (
			id INT AUTO_INCREMENT PRIMARY KEY,
			product_id INT NOT NULL,
			alias_gtin VARCHAR(100) NOT NULL,
			relation_type ENUM('package_unit', 'equivalent', 'legacy', 'other') DEFAULT 'package_unit',
			package_quantity INT NULL COMMENT 'Optionale Anzahl Einzelstücke pro Packung',
			notes TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT fk_product_gtin_aliases_product
				FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
			UNIQUE KEY uniq_product_alias_gtin (product_id, alias_gtin),
			UNIQUE KEY uniq_alias_gtin (alias_gtin),
			INDEX idx_product_gtin_aliases_product (product_id),
			INDEX idx_product_gtin_aliases_alias (alias_gtin)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
	`);
}

export function normalizeGtin(value: unknown): string {
	return String(value || '').trim();
}

export function parseAlternativeGtins(value: unknown, primaryGtin?: string): string[] {
	const primary = normalizeGtin(primaryGtin);
	const rawValues = Array.isArray(value)
		? value
		: String(value || '').split(/[\n,;\s]+/);

	const seen = new Set<string>();
	const gtins: string[] = [];

	for (const rawValue of rawValues) {
		const gtin = normalizeGtin(rawValue);
		if (!gtin || gtin === primary || seen.has(gtin)) {
			continue;
		}

		seen.add(gtin);
		gtins.push(gtin);
	}

	return gtins;
}

export async function resolveEquivalentGtins(currentPool: any, gtinValue: string): Promise<ResolvedGtins> {
	const scannedGtin = normalizeGtin(gtinValue);
	if (!scannedGtin) {
		return { scannedGtin, gtins: [], matchedViaAlias: false };
	}

	try {
		await ensureProductGtinAliasesTable(currentPool);

		const [rows] = await currentPool.query(
			`SELECT DISTINCT candidate_gtin
			 FROM (
				 SELECT ? AS candidate_gtin
				 UNION
				 SELECT p.gtin AS candidate_gtin
				 FROM products p
				 WHERE p.gtin = ?
				 UNION
				 SELECT p.gtin AS candidate_gtin
				 FROM products p
				 JOIN product_gtin_aliases pga ON pga.product_id = p.id
				 WHERE pga.alias_gtin = ?
				 UNION
				 SELECT pga.alias_gtin AS candidate_gtin
				 FROM product_gtin_aliases pga
				 JOIN products p ON p.id = pga.product_id
				 WHERE p.gtin = ?
				 UNION
				 SELECT pga2.alias_gtin AS candidate_gtin
				 FROM product_gtin_aliases pga1
				 JOIN product_gtin_aliases pga2 ON pga2.product_id = pga1.product_id
				 WHERE pga1.alias_gtin = ?
			 ) resolved_gtins
			 WHERE candidate_gtin IS NOT NULL AND candidate_gtin != ''`,
			[scannedGtin, scannedGtin, scannedGtin, scannedGtin, scannedGtin]
		) as [RowDataPacket[], any];

		const gtins = rows.map((row: RowDataPacket) => normalizeGtin(row.candidate_gtin)).filter(Boolean);
		const uniqueGtins = Array.from(new Set([scannedGtin, ...gtins]));

		return {
			scannedGtin,
			gtins: uniqueGtins,
			matchedViaAlias: uniqueGtins.some(gtin => gtin !== scannedGtin)
		};
	} catch (error: any) {
		if (error?.code === 'ER_NO_SUCH_TABLE') {
			return { scannedGtin, gtins: [scannedGtin], matchedViaAlias: false };
		}

		throw error;
	}
}

export async function getAlternativeGtinsForProduct(currentPool: any, productId: number): Promise<string[]> {
	await ensureProductGtinAliasesTable(currentPool);

	const [rows] = await currentPool.query(
		`SELECT alias_gtin
		 FROM product_gtin_aliases
		 WHERE product_id = ?
		 ORDER BY alias_gtin`,
		[productId]
	) as [RowDataPacket[], any];

	return rows.map((row: RowDataPacket) => normalizeGtin(row.alias_gtin)).filter(Boolean);
}

export async function getAlternativeGtinsForPrimaryGtin(currentPool: any, primaryGtin: string): Promise<string[]> {
	await ensureProductGtinAliasesTable(currentPool);

	const [rows] = await currentPool.query(
		`SELECT pga.alias_gtin
		 FROM product_gtin_aliases pga
		 JOIN products p ON p.id = pga.product_id
		 WHERE p.gtin = ?
		 ORDER BY pga.alias_gtin`,
		[primaryGtin]
	) as [RowDataPacket[], any];

	return rows.map((row: RowDataPacket) => normalizeGtin(row.alias_gtin)).filter(Boolean);
}

export async function syncProductGtinAliases(connection: any, productId: number, primaryGtin: string, aliasesValue: unknown): Promise<string[]> {
	const aliases = parseAlternativeGtins(aliasesValue, primaryGtin);
	await ensureProductGtinAliasesTable(connection);

	await connection.query('DELETE FROM product_gtin_aliases WHERE product_id = ?', [productId]);

	for (const aliasGtin of aliases) {
		await connection.query(
			`INSERT INTO product_gtin_aliases (product_id, alias_gtin, relation_type)
			 VALUES (?, ?, 'package_unit')
			 ON DUPLICATE KEY UPDATE product_id = VALUES(product_id), relation_type = VALUES(relation_type)`,
			[productId, aliasGtin]
		);
	}

	return aliases;
}

export async function addProductGtinAliases(connection: any, productId: number, primaryGtin: string, aliasesValue: unknown): Promise<string[]> {
	const aliases = parseAlternativeGtins(aliasesValue, primaryGtin);
	await ensureProductGtinAliasesTable(connection);

	for (const aliasGtin of aliases) {
		await connection.query(
			`INSERT INTO product_gtin_aliases (product_id, alias_gtin, relation_type)
			 VALUES (?, ?, 'package_unit')
			 ON DUPLICATE KEY UPDATE product_id = VALUES(product_id), relation_type = VALUES(relation_type)`,
			[productId, aliasGtin]
		);
	}

	return aliases;
}
