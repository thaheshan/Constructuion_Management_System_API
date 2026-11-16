import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SaveOwnerDetailsDto } from './dto/save-owner-details.dto';

describe('SaveOwnerDetailsDto Validation', () => {
  const validBasePayload = {
    fullName: 'K. A. Sunil Shantha Perera',
    email: 'sunil.perera@construction.lk',
    phone: '0771234567',
    nic: '198512345678',
    password: 'SecurePassword123!',
  };

  it('should pass validation with valid Step 1 owner details', async () => {
    const dto = plainToInstance(SaveOwnerDetailsDto, validBasePayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  describe('Phone Format Validation', () => {
    it.each([
      ['0771234567'],
      ['0712345678'],
      ['0761234567'],
      ['+94771234567'],
      ['94771234567'],
      ['0112345678'],
      ['+94112345678'],
    ])('should accept valid Sri Lankan phone: %s', async (phone) => {
      const dto = plainToInstance(SaveOwnerDetailsDto, {
        ...validBasePayload,
        phone,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it.each([
      ['12345'],
      ['077123'],
      ['abcdefghij'],
      ['077123456789'],
      ['+12025550143'],
      [''],
    ])('should reject invalid phone format: "%s"', async (phone) => {
      const dto = plainToInstance(SaveOwnerDetailsDto, {
        ...validBasePayload,
        phone,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const phoneError = errors.find((e) => e.property === 'phone');
      expect(phoneError).toBeDefined();
    });
  });

  describe('NIC-Style Name Validation', () => {
    it.each([
      ['Sunil Perera'],
      ['K. A. Sunil Shantha Perera'],
      ['A. B. C. Silva-Fernando'],
      ["O'Connor Perera"],
      ['Mohamed Rizwan'],
      ['T. Balasubramaniam'],
    ])('should accept valid NIC-style name: "%s"', async (fullName) => {
      const dto = plainToInstance(SaveOwnerDetailsDto, {
        ...validBasePayload,
        fullName,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it.each([
      ['Sunil123'],
      ['Sunil @ Perera'],
      ['<script>alert(1)</script>'],
      ['A'],
      [''],
    ])('should reject invalid NIC-style name: "%s"', async (fullName) => {
      const dto = plainToInstance(SaveOwnerDetailsDto, {
        ...validBasePayload,
        fullName,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find((e) => e.property === 'fullName');
      expect(nameError).toBeDefined();
    });
  });

  describe('Password Rules Validation', () => {
    it.each([
      ['SecurePassword123!'],
      ['Str0ngP@ss#2026'],
      ['CmsProject$99'],
    ])('should accept strong password: "%s"', async (password) => {
      const dto = plainToInstance(SaveOwnerDetailsDto, {
        ...validBasePayload,
        password,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it.each([
      ['short1!'], // < 8 characters
      ['alllowercase123!'], // no uppercase
      ['ALLUPPERCASE123!'], // no lowercase
      ['NoDigitsHere!@#'], // no digit
      ['NoSpecialChar123'], // no special character
      [''],
    ])('should reject non-compliant password: "%s"', async (password) => {
      const dto = plainToInstance(SaveOwnerDetailsDto, {
        ...validBasePayload,
        password,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
    });
  });

  describe('Sri Lankan NIC Validation', () => {
    it.each([
      ['198512345678'], // New 12-digit NIC
      ['200012345678'],
      ['851234567V'], // Old 9-digit + V
      ['921234567X'], // Old 9-digit + X
      ['851234567v'],
    ])('should accept valid Sri Lankan NIC: "%s"', async (nic) => {
      const dto = plainToInstance(SaveOwnerDetailsDto, {
        ...validBasePayload,
        nic,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it.each([
      ['12345'],
      ['85123456A'],
      ['19851234567890'],
      ['INVALIDNIC'],
      [''],
    ])('should reject invalid Sri Lankan NIC: "%s"', async (nic) => {
      const dto = plainToInstance(SaveOwnerDetailsDto, {
        ...validBasePayload,
        nic,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nicError = errors.find((e) => e.property === 'nic');
      expect(nicError).toBeDefined();
    });
  });
});
