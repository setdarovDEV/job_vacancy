// Package validate wraps go-playground/validator and turns failures into apperr.Validation.
package validate

import (
	"errors"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"

	"jobvacancy.uz/backend/internal/pkg/apperr"
)

var v = func() *validator.Validate {
	val := validator.New(validator.WithRequiredStructEnabled())
	// Report JSON field names ("full_name"), not Go names ("FullName").
	val.RegisterTagNameFunc(func(f reflect.StructField) string {
		name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
		if name == "-" {
			return ""
		}
		return name
	})
	_ = val.RegisterValidation("password", func(fl validator.FieldLevel) bool {
		return IsStrongPassword(fl.Field().String())
	})
	return val
}()

// Struct validates s. Each field error is reported as its failing rule, e.g.
// {"email": "email", "password": "min=8"}; clients map these to localized messages.
func Struct(s any) error {
	err := v.Struct(s)
	if err == nil {
		return nil
	}
	var ve validator.ValidationErrors
	if !errors.As(err, &ve) {
		return apperr.BadRequest("invalid_request", err.Error())
	}
	fields := make(map[string]string, len(ve))
	for _, fe := range ve {
		rule := fe.Tag()
		if fe.Param() != "" {
			rule += "=" + fe.Param()
		}
		fields[fe.Field()] = rule
	}
	return apperr.Validation(fields)
}

// IsStrongPassword requires 8..72 chars with at least one letter and one digit.
func IsStrongPassword(p string) bool {
	if len(p) < 8 || len(p) > 72 {
		return false
	}
	var letter, digit bool
	for _, r := range p {
		switch {
		case r >= '0' && r <= '9':
			digit = true
		case r > 127 || (r|0x20 >= 'a' && r|0x20 <= 'z'):
			letter = true
		}
	}
	return letter && digit
}
