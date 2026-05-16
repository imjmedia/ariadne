/**
 * @fileoverview ReviewController — endpoints HTTP para el Review Engine.
 * Expone POST /api/internal/review/diff para iniciar reviews.
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewRequest } from './types';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * Inicia un review de cambios legacy.
   * Acepta diff como texto o URL de PR.
   */
  @Post('diff')
  async startReview(@Body() body: ReviewRequest) {
    return this.reviewService.startReview(body);
  }

  /**
   * Obtiene el estado de un review (para polling).
   */
  @Get(':reviewId/status')
  getStatus(@Param('reviewId') reviewId: string) {
    return this.reviewService.getStatus(reviewId);
  }

  /**
   * Obtiene el reporte renderizado de un review.
   */
  @Get(':reviewId/report')
  getReport(
    @Param('reviewId') reviewId: string,
    @Query('format') format?: string
  ) {
    const fmt = format === 'json' ? 'json' : 'md';
    const report = this.reviewService.getReport(reviewId, fmt);
    if (!report) {
      return { error: 'Review no encontrado o aún no completado' };
    }
    return report;
  }
}
