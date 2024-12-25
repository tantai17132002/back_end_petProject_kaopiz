import { BadRequestException, Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';
import { hashPasswordHelper } from '@/helpers/until';
import aqp from 'api-query-params';
import mongoose from 'mongoose';
import { ChangePasswordAuthDto, CodeAuthDto, CreateAuthDto } from '@/auth/dto/create-auth.dto';
// import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
// import { MailerService } from '@nestjs-modules/mailer';
import { MESSAGES } from './messages';
import { EmailService } from '@/helpers/email.service';
import { generateVerificationCode, isCodeValid } from '@/helpers/code.helper';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    private readonly emailService: EmailService,
  ) { }

  isEmailExist = async (email: string) => {
    const user = await this.userModel.exists({ email });
    if (user) return true;
    return false;
  }

  async findAll(query: string, current: number, pageSize: number) {
    const { filter, sort } = aqp(query);
    if (filter.current) delete filter.current;
    if (filter.pageSize) delete filter.pageSize;

    if (!current) current = 1;
    if (!pageSize) pageSize = 10;

    const totalItems = (await this.userModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const skip = (current - 1) * (pageSize);

    const results = await this.userModel
      .find(filter)
      .limit(pageSize)
      .skip(skip)
      .select("-password")
      .sort(sort as any);

    return {
      meta: {
        current: current,
        pageSize: pageSize,
        pages: totalPages,
        total: totalItems
      },
      results
    }
  }


  async findOne(id: string) {
    if (!id) throw new BadRequestException(MESSAGES.INVALID_ID);
    return this.userModel.findById(id).select('-password');
  }

  async findByEmail(email: string) {
    return await this.userModel.findOne({ email })
  }

  async update(updateUserDto: UpdateUserDto) {
    return await this.userModel.updateOne(
      { _id: updateUserDto._id }, { ...updateUserDto });
  }

  async remove(_id: string) {
    if (!mongoose.isValidObjectId(_id)) {
      throw new BadRequestException(MESSAGES.INVALID_ID_DB);
    }
    return this.userModel.deleteOne({ _id });
  }

  async handleRegister(registerDto: CreateAuthDto) {
    const { name, email, password } = registerDto;

    // Check if email exists
    const isExist = await this.isEmailExist(email);
    if (isExist) {
      throw new BadRequestException(`${MESSAGES.EMAIL_EXISTS}: ${email}`)
    }

    //hash password
    const hashPassword = await hashPasswordHelper(password);

    // Generate authentication code
    const { codeId, codeExpired } = generateVerificationCode();

    // Create new user
    const user = await this.userModel.create({
      name, email, password: hashPassword,
      isActive: false,
      activationCode: codeId,
      activationCodeExpired: codeExpired
    });

    //Send account activation email
    await this.emailService.sendEmail(
      user.email,
      'Activate your account at Mendover',
      'register',
      {
        name: user?.name ?? user.email,
        activationCode: codeId,
      }
    )

    return {
      _id: user._id
    }

  }

  async handleActive(data: CodeAuthDto) {
    const user = await this.userModel.findOne({
      activationCode: data.code,
    });
  
    if (!user) {
      throw new BadRequestException(MESSAGES.INVALID_CODE);
    }
  
    // Check if code is expired
    const isBeforeCheck = dayjs().isBefore(user.activationCodeExpired);
  
    if (isBeforeCheck) {
      // Valid code => Activate account
      await user.updateOne({
        isActive: true,
        activationCode: null,
        activationCodeExpired: null,
      });
  
      return { isBeforeCheck };
    } else {
      throw new BadRequestException(MESSAGES.INVALID_CODE);
    }
  }
  

  async retryActive(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException(MESSAGES.USER_NOT_FOUND);
    }
    if (user.isActive) {
      throw new BadRequestException(MESSAGES.ACCOUNT_ACTIVATED);
    }
  
    // Generate new activation code
    const { codeId, codeExpired } = generateVerificationCode();
  
    // Update activation code
    await user.updateOne({
      activationCode: codeId,
      activationCodeExpired: codeExpired,
    });
  
    // Send activation email
    await this.emailService.sendEmail(
      user.email,
      'Activate your account at Mendover',
      'register',
      { name: user?.name ?? user.email, activationCode: codeId },
    );
  
    return { _id: user._id };
  }
  

  async retryPassword(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException(MESSAGES.USER_NOT_FOUND);
    }
  
    // Generate reset password code
    const { codeId, codeExpired } = generateVerificationCode();
  
    // Update reset password code
    await user.updateOne({
      resetPasswordCode: codeId,
      resetPasswordCodeExpired: codeExpired,
    });
  
    // Send reset password email
    await this.emailService.sendEmail(
      user.email,
      'Change your password account at Mendover',
      'retrypassword',
      {
        name: user?.name ?? user.email,
        activationCode: codeId,
      },
    );
  
    return { _id: user._id, email: user.email };
  }

  async changePassword(data: ChangePasswordAuthDto) {
    if (data.confirmPassword !== data.password) {
      throw new BadRequestException(MESSAGES.PASSWORD_CONFIRM_MISMATCH);
    }
  
    const user = await this.userModel.findOne({ email: data.email });
    if (!user) {
      throw new BadRequestException(MESSAGES.USER_NOT_FOUND);
    }
  
    if (user.resetPasswordCode !== data.code || !isCodeValid(user.resetPasswordCodeExpired)) {
      throw new BadRequestException(MESSAGES.INVALID_CODE);
    }
  
    const newPassword = await hashPasswordHelper(data.password);
    await user.updateOne({
      password: newPassword,
      resetPasswordCode: null,
      resetPasswordCodeExpired: null,
    });
  
    return { success: true };
  }
  
}
